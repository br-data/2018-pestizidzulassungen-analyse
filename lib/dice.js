// Calculate the Sørensen–Dice similarity between two strings
// https://en.wikipedia.org/wiki/S%C3%B8rensen%E2%80%93Dice_coefficient

function diceCoefficient(str1, str2) {

  if (str1 === str2) {

    return 1;
  }

  const len1 = str1.length - 1;
  const len2 = str2.length - 1;

  if (len1 < 1 || len2 < 1) {

    return 0;
  }

  let intersection = 0;

  const bigrams1 = getBigrams(str1);
  const bigrams2 = getBigrams(str2);

  for (let i = 0; i < len1; i++) {

    for (let j = 0; j < len2; j++) {

      if (bigrams1[i] == bigrams2[j]) {

        intersection++;
        bigrams2[j] = null;

        break;
      }
    }
  }

  return (2.0 * intersection) / (len1 + len2);
}

function getBigrams(str) {

  const bigrams = [];
  const len = str.length;

  for (let i = 0; i < len; i++) {

    bigrams.push(str.substr(i, 2));
  }

  return bigrams;
}

module.exports = diceCoefficient;
