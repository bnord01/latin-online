'use strict';
const ENABLE_REMOVE = true;

angular.module("latin-o", ['ui.bootstrap'])
  .controller("LatinOController", function($scope, $http, $filter, $uibModal) {
    $scope.dictionary;
    $scope.learnset;
    $scope.keys;
    $scope.current_latin;
    $scope.current_german = "";
    $scope.correct = true;
    $scope.mistakes=[];
    $scope.last_latin
    $scope.last_expected
    $scope.last_input
    $scope.enable_remove = ENABLE_REMOVE;

    $http.get("dictionary").success(function(data) {
      $scope.dictionary = data;
      $scope.keys = Object.keys($scope.dictionary);
    });

    $http.get("learnset").success(function(data) {
      $scope.learnset = data;
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
        let learnset = $scope.learnset;
        if(learnset.length>0) {
            $scope.current_latin = learnset[Math.floor(Math.random() * learnset.length)];
            $scope.current_german = "";
        }
    }

    $scope.check = function() {
        let input = $scope.current_german.split(",").map(x=>x.trim());
        let latin = $scope.current_latin
        let expected = $scope.dictionary[latin];
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
        $scope.last_latin = $scope.current_latin
        $scope.last_input = $scope.current_german
        $scope.last_expected = expected.join(', ')

        if(correct){
            let idx = $scope.learnset.indexOf(latin)
            $scope.learnset.splice(idx,1)
            $http.post("correct",{phrase:latin})
        } else {
            $http.post("incorrect",{phrase:latin})
        }
        updateRandomLatin();
    }

    if(ENABLE_REMOVE) {
        $scope.remove = function(latin) {
            let r = confirm("Eintrag "+ latin+ " wirklich löschen?")
            if(r) {
                delete $scope.dictionary[latin];
                $scope.keys = Object.keys($scope.dictionary)
                $http.post("remove",{latin:latin})
                updateRandomLatin();
            }
        }
    }
  });


// Controller for the info modal.
angular.module('latin-o').controller('InfoModalInstanceCtrl', function($scope, $uibModalInstance) {
  $scope.close = function() {
    $uibModalInstance.dismiss('close');
  };
});
