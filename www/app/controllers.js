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
			feedhenry.cloud({
				path : '/v1/api/claim',
				method : 'GET',
				contentType : 'application/json'
			}, function(response) {
				$timeout(function() {
					vm.claims = response;
					vm.claimCount = 0;
					vm.claims.list.forEach(function(elt, i) {
						if (elt.fields.approved === null) {
							vm.claimCount++;
						}
					});
				});
			}, function(message, error) {
				$log.info(message);
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
			adjustedValue : null,
			comments : []
		};

		vm.finishIncident = finishIncident;
		vm.submitIncident = submitIncident;
		vm.updateAnswers = updateAnswers;

		function saveClaim(claim) {
			// If there is a claim persist it to the DB
			if (claim) {
				// Clean out any angular $resource metadata
				FHCObjectScrubber.cleanObject(claim.questionnaires[0]);
				FHCObjectScrubber.cleanObject(claim.incident);
				claim.questionnaires[0].questions.forEach(function(elt, i) {
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
			if (claim) {
				// Clean out any angular $resource metadata
				FHCObjectScrubber.cleanObject(claim.questionnaires[0]);
				FHCObjectScrubber.cleanObject(claim.incident);
				claim.questionnaires[0].questions.forEach(function(elt, i) {
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
			var answers = [];
			vm.claim.questionnaires[0].questions.forEach(function(elt, i) {
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
				answer.questionId = vm.claim.questionnaires[0].questions[i].questionId;
				if (elt === true) {
					answer.strValue = 'Yes';
				} else if (elt === false) {
					answer.strValue = 'No';
				} else {
					answer.strValue = elt;
				}
				answers.push(answer);
			});
			vm.claim.questionnaires[0].answers = answers;
			if (vm.claim.questionnaires[0].answers.length > 0) {
				FHCObjectScrubber.cleanObject(vm.claim.questionnaires[0]);
				vm.claim.questionnaires[0].questions.forEach(function(elt, i) {
					FHCObjectScrubber.cleanObject(elt);
				});
				feedhenry.cloud({
					path : '/api/v1/bpms/update-questions',
					method : 'POST',
					contentType : 'application/json',
					data : vm.claim.questionnaires[0]
				}, function(response) {
					$timeout(function() {
						vm.claim.questionnaires[0] = response;
					});
				}, function(message, error) {
					$log.info(message);
					$log.error(error);
				});
			}
		}

		function finishIncident() {
			if (vm.claim && vm.claim.incident && vm.claim.statedValue) {
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
				$timeout(function() {
					vm.claim.questionnaires[0] = response;
					vm.answers = [];
					vm.showIncident = false;
					vm.showQuestions = true;
				});
			}, function(message, error) {
				$log.info(message);
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
			if ($rootScope.claim) {
				vm.claim = $rootScope.claim;
				if (vm.claim.fields.adjustedValue) {
					vm.showAdjustedValue = true;
				}
				vm.hasClaim = true;
			} else {
				$location.path('/claims');
			}
		}

		function saveComment() {
			if (vm.comment) {
				feedhenry.cloud({
					path : '/api/v1/bpms/add-comments/' + vm.claim.fields.processId,
					method : 'POST',
					contentType : 'application/json',
					data : {
						claimComments : vm.comment,
						messageSource : 'customer'
					}
				});
				vm.claim.fields.comments.push({
					message : vm.comment,
					title : '',
					commenterName : '',
					commentDate : new Date()
				});
				vm.comment = '';
				updateClaim(vm.claim.fields);
			}
		}

		function takePhoto(source) {
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
			var url = $fh.getCloudURL();

			var options = new FileUploadOptions();
			options.fileKey = "file";
			options.fileName = imageUri.substr(imageUri.lastIndexOf('/') + 1);
			options.mimeType = "image/jpeg";

			var ft = new FileTransfer();
			ft.upload(imageUri, encodeURI(url + '/api/v1/bpms/upload-photo/' + vm.claim.fields.processId + '/' + options.fileName), function(success) {
				var response = success.response;
				var parsedResponse = JSON.parse(response.replace('\\', ''));
				var photo = {
					photoUrl : parsedResponse.photoLink,
					description : '',
					uploaderName : vm.claim.fields.id,
					uploadDate : new Date(),
					takenDate : ''
				}
				vm.claim.fields.photos.push(photo);
				updateClaim(vm.claim.fields);
				vm.showUploadSpinner = false;
			}, function(error) {
				vm.showUploadSpinner = false;
				$log.error(error);
			}, options);
		}

		function updateClaim(claim) {
			if (claim) {
				// Clean out any angular $resource metadata
				FHCObjectScrubber.cleanObject(claim.questionnaires[0]);
				FHCObjectScrubber.cleanObject(claim.incident);
				// POST to the could endpoint
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

		loadClaim();

		$ionicPlatform.ready(function() {
			$log.info('ready');
			ready = true;
		});

	}

})();
