'use strict';
const ENABLE_REMOVE = true;

const app = angular.module("latin-o", ['ui.bootstrap','ngAnimate'])

app.controller("LatinOController", function($scope, $http, $filter, $uibModal, focus) {
    $scope.dictionary;
    $scope.learnset;
    $scope.keys;
    $scope.current_latin;
    $scope.current_german = "";
    $scope.correct = true;
    $scope.mistakes = [];
    $scope.last_latin
    $scope.last_expected
    $scope.last_input
    $scope.enable_remove = ENABLE_REMOVE;
    $scope.dict_error
    $scope.show_dict = false

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

    $scope.numEntries = function() {
        return $scope.keys.length;
    }

    $scope.addTranslation = function() {
        let latin = $scope.latin
        let german = $scope.german
        if (latin && german) {
            $http.post("translation", {
                latin: latin,
                german: german
            }).then(res => {
                $scope.dictionary[latin] = german.split(",").map(x => x.trim());
                $scope.keys = Object.keys($scope.dictionary);
                $scope.learnset.push(latin)
                $scope.latin = ""
                $scope.german = ""
                $scope.dict_conflict = false
                focus('focusLatin')
                updateRandomLatin();
            }).catch(err => {
                $scope.dict_conflict = true
            });

        }
    }

    function updateRandomLatin() {
        let learnset = $scope.learnset;
        if (learnset.length > 0) {
            $scope.current_latin = learnset[Math.floor(Math.random() * learnset.length)];
            $scope.current_german = "";
        }
    }

    $scope.check = function() {
        if (!$scope.current_german)
            return;
        $scope.odd = !$scope.odd
        let input = $scope.current_german.split(",").map(x => x.trim());
        let latin = $scope.current_latin
        let expected = $scope.dictionary[latin];
        let correct = false
        let mistakes = [];
        for (let e of expected) {
            if (!input.includes(e)) {
                mistakes.push("Eingabe enthält nicht: " + e)
            } else {
                correct = true;
            }
        }
        for (let i of input) {
            if (!expected.includes(i)) {
                mistakes.push("Wörterbuch enthält nicht: " + i)
                correct = false;
            }
        }
        $scope.correct = correct;
        $scope.mistakes = mistakes;
        $scope.last_latin = $scope.current_latin
        $scope.last_input = $scope.current_german
        $scope.last_expected = expected.join(', ')

        if (correct) {
            let idx = $scope.learnset.indexOf(latin)
            if (idx != -1) {
                $scope.learnset.splice(idx, 1)
            }
            $http.post("correct", {
                phrase: latin
            })
        } else {
            $http.post("incorrect", {
                phrase: latin
            })
        }
        updateRandomLatin();
    }

    if (ENABLE_REMOVE) {
        $scope.remove = function(latin) {
            let r = confirm("Eintrag " + latin + " wirklich löschen?")
            if (r) {
                $http.post("remove", {
                    latin: latin
                }).then(() => {
                    let german = $scope.dictionary[latin]
                    delete $scope.dictionary[latin];
                    $scope.keys = Object.keys($scope.dictionary)
                    let idx = $scope.learnset.indexOf(latin)
                    if (idx != -1) {
                        $scope.learnset.splice(idx, 1)
                    }
                    $scope.latin = latin
                    $scope.german = german?german.join(', '):''
                    focus('focusLatin')
                })
                updateRandomLatin();
            }
        }
    }
});

app.directive('focusOn', function() {
    return function(scope, elem, attr) {
        scope.$on('focusOn', function(e, name) {
            if (name === attr.focusOn) {
                elem[0].focus();
            }
        });
    };
});

app.factory('focus', function($rootScope, $timeout) {
    return function(name) {
        $timeout(function() {
            $rootScope.$broadcast('focusOn', name);
        });
    }
});


// Controller for the info modal.
app.controller('InfoModalInstanceCtrl', function($scope, $uibModalInstance) {
    $scope.close = function() {
        $uibModalInstance.dismiss('close');
    };
});
