var scroll = (function () {

  function to(offset, duration) {

    var start = (document.documentElement && document.documentElement.scrollTop) || document.body.scrollTop;
    var change = offset - start;
    var increment = 20;

    var animateScroll = function (elapsedTime) {

      elapsedTime += increment;

      var position = easeInOut(elapsedTime, start, change, duration);

      // Chrome and Firefox use different scroll containers, so both get scrolled
      // @TODO Improve this somehow
      document.documentElement.scrollTop = position;
      document.body.scrollTop = position;

      // @TODO Use requestAnimationFrame instead
      if (elapsedTime < duration) {

        setTimeout(function() {

          animateScroll(elapsedTime);
        }, increment);
      }
    };

    animateScroll(0);
  }

  function easeInOut(currentTime, start, change, duration) {

    currentTime /= duration / 2;

    if (currentTime < 1) {

      return change / 2 * currentTime * currentTime + start;
    }

    currentTime -= 1;

    return -change / 2 * (currentTime * (currentTime - 2) - 1) + start;
  }

  return {
    to: to
  };
})();
