angular.module("latin-o", ['ui.bootstrap'])
  .controller("LatinOController", function($scope, $http, $filter, $uibModal) {
    $scope.dictionary;
    $scope.keys;
    $scope.current_latin;
    $scope.current_german = "";
    $scope.correct = true;
    $scope.mistakes=[];
    $http.get("dictionary").success(function(data) {
      $scope.dictionary = data;
      $scope.keys = Object.keys($scope.dictionary);
      updateRandomLatin();
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

    $scope.numEntries = function () {
        return $scope.keys.length;
    }

    $scope.addTranslation = function () {
        if ($scope.latin && $scope.german) {
            $scope.dictionary[$scope.latin] = $scope.german.split(",").map(x => x.trim());
            $scope.keys = Object.keys($scope.dictionary);
            $http.post("translation",{latin:$scope.latin,german:$scope.german});
            $scope.latin=""
            $scope.german=""
        }
        updateRandomLatin();
    }

    function updateRandomLatin() {
        let keys = $scope.keys;
        $scope.current_latin = keys[Math.floor(Math.random() * keys.length)];
        $scope.current_german = "";
    }

    $scope.check = function() {
        let input = $scope.current_german.split(",").map(x=>x.trim());
        let expected = $scope.dictionary[$scope.current_latin];
        let correct = false
        let mistakes = [];
        for(let e of expected) {
            if(!input.includes(e)){
                mistakes.push("Eingabe enthält nicht: " + e)
            } else {
                correct = true;
            }
        }
        for(let i of input) {
            if(!expected.includes(i)){
                mistakes.push("Wörterbuch enthält nicht: " + i)
                correct = false;
            }
        }
        $scope.correct = correct;
        $scope.mistakes = mistakes;
        updateRandomLatin();
    }

    /*
    $scope.remove = function(latin) {
        delete $scope.dictionary[latin];
        $scope.keys = Object.keys($scope.dictionary)
        $http.post("remove",{latin:latin})
        updateRandomLatin();
    }
    */
  });


// Controller for the info modal.
angular.module('latin-o').controller('InfoModalInstanceCtrl', function($scope, $uibModalInstance) {
  $scope.close = function() {
    $uibModalInstance.dismiss('close');
  };
});
