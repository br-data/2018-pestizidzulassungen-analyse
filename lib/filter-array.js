// Filter object array by missing values per key

function filterArray(arr, keys) {

  return arr.filter(obj =>
    keys.every(key =>
      //obj.hasOwnProperty(key)
      obj[key] && obj[key].length > 0
    )
  );
}

module.exports = filterArray;
