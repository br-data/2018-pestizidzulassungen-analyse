// Split object array into a specific number of chunks

function chunkArray(arr, key, length) {

  const sortedArr = arr.sort((a, b) =>
    b[key].length - a[key].length
  );

  const chunks = sortedArr.reduce((acc, obj) => {

    const minLength = Math.min.apply(Math, acc.lengths);
    const minIndex = acc.lengths.indexOf(minLength);

    acc.groups[minIndex] = acc.groups[minIndex].concat([obj]);
    acc.lengths[minIndex] += obj[key].length;

    return acc;
  }, {
    lengths: new Array(length).fill(0),
    groups: new Array(length).fill([])
  });

  return chunks.groups.filter(group => group.length);
}

module.exports = chunkArray;
