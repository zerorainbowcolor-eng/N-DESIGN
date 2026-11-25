// 見出し演出：初めて画面に入ったときに一度だけ再生
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var heads = document.querySelectorAll('.sec-ja.sec-head');
  if (!heads.length) return;
  document.documentElement.classList.add('sh-ready');
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('sh-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -15% 0px' });
  heads.forEach(function (h) { io.observe(h); });
})();
