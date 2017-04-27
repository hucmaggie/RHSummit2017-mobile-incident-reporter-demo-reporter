(function() {
	'use strict';

	angular.module('claimeeApp.controllers', [ 'fhcloud', 'ngCordova' ]);

	angular.module('claimeeApp.controllers').controller('ClaimsController', claimsController).controller('NewClaimController', newClaimController).controller('ClaimDetailController', claimDetailController);

	function claimsController($log, $rootScope, $timeout) {
		$log.info('Inside Claimee:ClaimsController');
		var vm = this;

		vm.loadClaimDetails = loadClaimDetails;

		function loadClaimDetails(claim) {
			if (claim) {
				$rootScope.claim = claim;
			}
		}

		function loadClaims() {

            $log.info("Inside claimsController:loadClaims");

			feedhenry.cloud({
				path : '/v1/api/claim',
				method : 'GET',
				contentType : 'application/json'
			}, function(response) {
				$timeout(function() {

                    $log.info("got Claims: ", response);
					vm.claims = response;
					vm.claimCount = 0;

					if (vm.claims != null || vm.claims != undefined){

                        vm.claims.forEach(function(claim) {

                            vm.claimCount++;

                            // lets fix the photos
                            if (claim.incidentPhotoIds && claim.incidentPhotoIds.length > 0){
                                claim.photos = [];
                                claim.incidentPhotoIds.forEach(function(p, i) {

                                    var link = 'http://services-incident-demo.apps.ocp.hucmaggie.com/photos/' + claim.processId + '/' + p.replace(/'/g, '')
                                    claim.photos.push(link);
                                    $log.info("photo link: ", link);
                                });
                            }

                        });

                        $log.info("found " + vm.claimCount + " existing Claim(s)");
					}
					else{
                        $log.info("no existing Claims");
					}

				});
			}, function(message, error) {
				$log.info("loadClaims: " + message);
				$log.error(error);
			});
		}

		loadClaims();
	}

	function newClaimController($log, $timeout, $location, FHCObjectScrubber, Claims, Incidents, UUID, States) {
		$log.info('Inside Claimee:NewClaimController');
		var vm = this;

		vm.showIncident = true;
		vm.showQuestions = false;
		vm.incidentTypes = Claims.getClaimTypes();
		vm.states = States;
		vm.claim = {
			id : 0,
			processId : 0,
			incident : {
				id : null,
				type : null,
				description : null,
				incidentDate : null,
				stateCode : null,
				zipCode : null
			},
			customer : null,
			questionnaires : [],
			photos : [],
			approved : null,
			statedValue : null,
			comments : []
		};

		vm.finishIncident = finishIncident;
		vm.submitIncident = submitIncident;
		vm.updateAnswers = updateAnswers;

		function saveClaim(claim) {

            $log.info("Inside saveClaim, claim: ", claim);

			// If there is a claim persist it to the DB
			if (claim) {
				// Clean out any angular $resource metadata
				FHCObjectScrubber.cleanObject(claim.questionnaire);
				FHCObjectScrubber.cleanObject(claim.incident);
				claim.questionnaire.questions.forEach(function(elt, i) {
					FHCObjectScrubber.cleanObject(elt);
				});
				// POST to the could endpoint
				feedhenry.cloud({
					path : '/v1/api/claim',
					method : 'POST',
					contentType : 'application/json',
					data : claim
				}, function(response) {
					// Track the DB id for updates
					vm.claim.id = response.guid;
					updateClaim(claim);
				}, function(message, error) {
					$log.info(message);
					$log.error(error);
				});
			}
		}

		function updateClaim(claim) {
            $log.info("Inside newClaimController:updateClaim, claim: ", claim);

			if (claim) {
				// Clean out any angular $resource metadata
				FHCObjectScrubber.cleanObject(claim.questionnaire);
				FHCObjectScrubber.cleanObject(claim.incident);
				claim.questionnaire.questions.forEach(function(elt, i) {
					FHCObjectScrubber.cleanObject(elt);
				});
				// POST to the cloud endpoint
				feedhenry.cloud({
					path : '/v1/api/claim',
					method : 'PUT',
					contentType : 'application/json',
					data : claim
				}, function(response) {
					// Track the DB id for updates
					vm.claim.id = response.guid;
				}, function(message, error) {
					$log.info(message);
					$log.error(error);
				});
			}
		}

		function updateAnswers() {

            $log.info("Inside updateAnswers");

			var answers = [];
			vm.claim.questionnaire.questions.forEach(function(elt, i) {

                $log.info("check answer for question["+elt.questionId+"]");
			    if (!vm.answers[i]) {
					if (elt.answerType === 'YES_NO') {
						vm.answers[i] = false;
					} else {
						vm.answers[i] = '';
					}
				}
			});

			vm.answers.forEach(function(elt, i) {
				var answer = {};
				answer.questionId = vm.claim.questionnaire.questions[i].questionId;

                $log.info("check answer["+elt.questionId+"], value["+elt.strValue+"]", elt);

				if (elt === true) {
					answer.strValue = 'Yes';
				} else if (elt === false) {
					answer.strValue = 'No';
				} else {
					answer.strValue = elt;
				}

                $log.info("save answer: ", answer);
				answers.push(answer);
			});

            $log.info("answers: ", answers);

			vm.claim.questionnaire.answers = answers;

            //$log.info("questionnaire: ", vm.claim.questionnaire);

			if (vm.claim.questionnaire.answers.length > 0) {

                $log.info("clean questionnaire");

				FHCObjectScrubber.cleanObject(vm.claim.questionnaire);

				vm.claim.questionnaire.questions.forEach(function(elt, i) {
					FHCObjectScrubber.cleanObject(elt);
				});

                $log.info("questionnaire: ", vm.claim.questionnaire);

				feedhenry.cloud({
					path : '/api/v1/bpms/update-questions',
					method : 'POST',
					contentType : 'application/json',
					data : vm.claim.questionnaire
				}, function(response) {
					$timeout(function() {
						vm.claim.questionnaire = response;

                        vm.claim.questionnaire.questions.forEach(function(elt) {

                            $log.info("question["+elt.questionId+"], enabled" + elt.enabled);

                        });

					});
				}, function(message, error) {
					$log.info(message);
					$log.error(error);
				});
			}
		}

		function finishIncident() {

            $log.info("Inside finishIncident");

			if (vm.claim && vm.claim.incident) {
				feedhenry.cloud({
					path : '/api/v1/bpms/startprocess',
					method : 'POST',
					contentType : 'application/json',
					data : {
						claimedAmount : vm.claim.statedValue
					}
				}, function(response) {
					$timeout(function() {
						vm.claim.processId = response; // Track claim by processId
						delete vm.claim.incident.$$hashKey;
						saveClaim(vm.claim);
						$timeout(function() {
							$location.path('/claims');
						}, 1000, true);
					}, 0, true, response);
				}, function(message, error) {
					$log.info(message);
					$log.error(error);
				});
			}
		}

		function submitIncident() {

            $log.info("Inside submitIncident");

			vm.claim.incident.id = vm.incident.id;
			vm.claim.incident.type = vm.incident.type;
			vm.claim.incident.description = vm.description;
			vm.claim.incident.incidentDate = vm.incidentDate;
			vm.claim.incident.stateCode = vm.stateCode;
			vm.claim.incident.zipCode = vm.zipCode;
			vm.claim.statedValue = vm.statedValue;

			delete vm.claim.incident.$$hashKey;

			feedhenry.cloud({
				path : '/api/v1/bpms/customer-incident',
				method : 'POST',
				contentType : 'application/json',
				data : vm.claim.incident
			}, function(response) {

                //$log.info("Got response: ", response);

                //var questionnaire = response.result["execution-results"].results[0].value["org.drools.core.runtime.rule.impl.FlatQueryResults"].idFactHandleMaps.element[0].element[0].value["org.drools.core.common.DisconnectedFactHandle"].object["com.redhat.vizuri.demo.domain.Questionnaire"];

                $log.info("Got questionnaire: ", response);
				$timeout(function() {
					vm.claim.questionnaire = response;
					vm.answers = [];
					vm.showIncident = false;
					vm.showQuestions = true;
				});
			}, function(message, error) {
				$log.info("Found error: ", message);
				$log.error(error);
			});
		}

	}

	function claimDetailController($http, $log, $location, $rootScope, $timeout, $ionicPlatform, $cordovaCamera, FHCObjectScrubber) {

		$log.info('Inside Claimee:ClaimDetailController');
		var vm = this;

		vm.hasClaim = false;
		vm.showUploadSpinner = false;
		var ready = false;

		vm.saveComment = saveComment;
		vm.takePhoto = takePhoto;

		function loadClaim() {

            $log.info("Inside claimDetailController:loadClaim");

			if ($rootScope.claim) {
				vm.claim = $rootScope.claim;
				// if (vm.claim.adjustedValue) {
				// 	vm.showAdjustedValue = true;
				// }
				vm.hasClaim = true;
			} else {
				$location.path('/claims');
			}
		}

		function saveComment() {

            $log.info("Inside saveComment: ", vm.comment);

            if (vm.comment) {
				feedhenry.cloud({
					path : '/api/v1/bpms/add-comments/' + vm.claim.processId,
					method : 'POST',
					contentType : 'application/json',
					data : {
						claimComments : vm.comment,
						messageSource : 'reporter'
					}
				});

                $log.info("done saving Comment: ", vm.comment);

				vm.claim.incidentComments.push({
					message : vm.comment,
					title : '',
					commenterName : '',
					commentDate : new Date()
				});
				vm.comment = '';
				//updateClaim(vm.claim);
			}
		}

		function takePhoto(source) {

            $log.info("Inside takePhoto, source: ", source);

			if (ready) {
				vm.showUploadSpinner = true;
				var options = {
					quality : 100,
					destinationType : 1,
					sourceType : source,
					encodingType : 0
				};
				$cordovaCamera.getPicture(options).then(function(imageData) {
					var imageUri = imageData;
					sendPhoto(imageUri);
					$cordovaCamera.cleanup(function() {
						$log.info('Cleanup Sucesss');
					}, function() {
						$log.info('Cleanup Failure');
					});
				}, function(err) {
					$log.info('Error');
					vm.showUploadSpinner = false;
				});
			} else {
				$log.info('Not ready!');
			}
		}

		function sendPhoto(imageUri) {

            $log.info("Inside sendPhoto, imageUri: ", imageUri);
			var url = $fh.getCloudURL();

			var options = new FileUploadOptions();
			options.fileKey = "file";
			options.fileName = imageUri.substr(imageUri.lastIndexOf('/') + 1);
			options.mimeType = "image/jpeg";

			var ft = new FileTransfer();
			ft.upload(imageUri, encodeURI(url + '/api/v1/bpms/upload-photo/' + vm.claim.processId + '/' + options.fileName), function(success) {
                $log.info("Found photo link: " + success.link);

			    var link = success.link;
				//var parsedResponse = JSON.parse(response.replace('\\', ''));
				// var photo = {
				//     // http://services-incident-demo.apps.ocp.hucmaggie.com/photos/1/iden_new.png
				// 	photoUrl : link,
				// 	description : '',
				// 	uploaderName : vm.claim.processId,
				// 	uploadDate : new Date(),
				// 	takenDate : ''
				// };

                //incidentPhotoIds
				vm.claim.photos.push(link);
				//updateClaim(vm.claim);
				vm.showUploadSpinner = false;
			}, function(error) {
				vm.showUploadSpinner = false;
				$log.error(error);
			}, options);
		}

		// function updateClaim(claim) {
        //
         //    $log.info("Inside claimDetailController:updateClaim, claim: ", claim);
        //
		// 	if (claim) {
		// 		// Clean out any angular $resource metadata
		// 		FHCObjectScrubber.cleanObject(claim.questionnaire);
		// 		FHCObjectScrubber.cleanObject(claim.incident);
		// 		// POST to the could endpoint
		// 		feedhenry.cloud({
		// 			path : '/v1/api/claim',
		// 			method : 'PUT',
		// 			contentType : 'application/json',
		// 			data : claim
		// 		}, function(response) {
		// 			// Track the DB id for updates
		// 			vm.claim.id = response.guid;
		// 		}, function(message, error) {
		// 			$log.info(message);
		// 			$log.error(error);
		// 		});
		// 	}
		// }

		loadClaim();

		$ionicPlatform.ready(function() {
			$log.info('ready');
			ready = true;
		});

	}

})();
