angular.module("latin-o", ['ui.bootstrap'])
  .controller("LatinOController", function($scope, $http, $filter, $uibModal) {
    $scope.dictionary;
    $http.get("dictionary/").success(function(data) {
      $scope.dictionary = data;
    });


    // Open info modal
    $scope.openInfo = function() {
      $uibModal.open({
        animation: true,
        templateUrl: 'InfoModal.html',
        controller: 'InfoModalInstanceCtrl',
        size: "lg"
      });
    };

  });


// Controller for the info modal.
angular.module('latin-o').controller('InfoModalInstanceCtrl', function($scope, $uibModalInstance) {
  $scope.close = function() {
    $uibModalInstance.dismiss('close');
  };
});
