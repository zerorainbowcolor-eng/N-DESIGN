/* FV以外の動き：ヘッダー、SPメニュー、スクロール演出、事業スライダー、社員カルーセル */
(() => {
  'use strict';

  const root = document.documentElement;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // GSAPが読めない／動きを減らす設定の時は、隠していた要素をそのまま表示する
  if (!hasGsap || reduceMotion) root.classList.remove('js');
  if (!hasGsap) { $$('.js-title-main, .js-title-sub').forEach((el) => { el.style.opacity = 1; }); }

  /* ------------------------------------------------------------
     SPメニュー
     ------------------------------------------------------------ */
  const header = $('.js-header');
  const menuBtn = $('.js-menu-btn');
  const gnav = $('.js-gnav');

  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    gnav.classList.toggle('is-open', open);
    header.classList.toggle('is-menu-open', open);
    document.body.classList.toggle('is-locked', open);
  }
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  $$('a', gnav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  window.matchMedia('(min-width: 1081px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ------------------------------------------------------------
     スクロール連動
     ------------------------------------------------------------ */
  const fvWrap = $('.js-fv-wrap');
  const overlay = $('.js-fv-overlay');

  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);

    // FV〜aboutを抜けたらヘッダーを白地に切り替え、背景スライダーの自動再生も止める
    ScrollTrigger.create({
      trigger: fvWrap, start: 'top top', end: 'bottom top+=80',
      onLeave: () => { header.classList.add('is-solid'); window.heroSlider && window.heroSlider.setVisible(false); },
      onEnterBack: () => { header.classList.remove('is-solid'); window.heroSlider && window.heroSlider.setVisible(true); },
    });

    // aboutに入るにつれて写真の上に紺の幕をかけ、文字を読みやすくする
    gsap.to(overlay, {
      opacity: 0.78, ease: 'none',
      scrollTrigger: { trigger: '#about', start: 'top bottom', end: 'top 30%', scrub: true },
    });

    // 見出しまわりの出現（セクションごとにまとめて、少しずつずらす）
    if (!reduceMotion) {
      ScrollTrigger.batch('.js-reveal', {
        start: 'top 86%', once: true,
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'power2.out', stagger: 0.12, overwrite: true }),
      });
    }
  } else {
    // GSAPなしの最低限：ヘッダー切り替えと幕だけ素のJSで行う
    overlay.style.opacity = 0.78;
    const onScroll = () => header.classList.toggle('is-solid', fvWrap.getBoundingClientRect().bottom < 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------
     スライダー（Swiper）
     ------------------------------------------------------------ */
  if (!window.Swiper) return;

  // 事業案内：右のリストと連動して切り替わる
  const listLinks = $$('.js-business-list a');
  const business = new Swiper('.js-business-slider', {
    effect: 'fade', fadeEffect: { crossFade: true }, speed: reduceMotion ? 0 : 900, loop: true,
    autoplay: reduceMotion ? false : { delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true },
    a11y: { enabled: true },
    on: {
      slideChange(sw) { listLinks.forEach((a, i) => a.classList.toggle('is-active', i === sw.realIndex)); },
    },
  });
  listLinks.forEach((a, i) => {
    const show = () => business.slideToLoop(i);
    a.addEventListener('mouseenter', show);
    a.addEventListener('focus', show);
  });

  // 働くひと：横に流せるカード列
  new Swiper('.js-team-slider', {
    slidesPerView: 'auto', spaceBetween: 20, speed: 700, grabCursor: true,
    breakpoints: { 768: { spaceBetween: 32 } },
    navigation: { prevEl: '.js-team-prev', nextEl: '.js-team-next' },
    // Swiperのa11yは前後ボタンのaria-labelを英語の既定文に上書きするので、日本語を渡しておく
    a11y: { prevSlideMessage: '前の社員へ', nextSlideMessage: '次の社員へ' },
    pagination: { el: '.js-team-progress', type: 'progressbar' },
  });
})();
