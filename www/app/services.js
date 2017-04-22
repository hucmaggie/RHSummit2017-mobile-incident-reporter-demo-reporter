(function() {
	'use strict';

	angular.module('claimeeApp.services', []);

	angular.module('claimeeApp.services')
	.constant('States', ['VA', 'NM'])
	.service('FHCObjectScrubber', function() {
		return {
			cleanObject : function cleanObject(object) {
				delete object.$promise;
				delete object.$resolved;
				delete object.$$hashKey;
				delete object.__fh;
				delete object.__proto__;
			}
		};
	})
	.service('Incidents', function($resource) {
		return {
			createNewIncident : function(type) {
				return {
					type : type,
					date : new Date(),
					userId : 'test user', // dynamically populate this field later
					id : Math.round(Math.random()*1000) + 1, // random ID
				}
			}
		}
	})
	.service('Claims', function($resource) {
		return {
			getClaimTypes() {
				return [{id:1, type: 'WINDSHIELD', description: '', incidentDate: '', stateCode : '', zipCode : ''}, {id:2, type: 'COLLISION', description: '', incidentDate: '', stateCode : '', zipCode : ''}, {id:3, type: 'HAIL', description: '', incidentDate: '', stateCode : '', zipCode : ''}];
			}
		}
	})
	.factory('UUID', function() {
		function guid() {
			function s4() {
				return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
			}
			return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
		}
		return guid();
	});

})();