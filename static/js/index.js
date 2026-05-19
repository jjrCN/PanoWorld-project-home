var QUANTITATIVE_CHART_CONFIGS = [
  {
    containerId: 'panorama-quant-chart',
    metrics: [
      {key: 'hpsv3', label: 'HPSv3', color: '#264653', better: 'higher', decimals: 4},
      {key: 'clipStyle', label: 'CLIP-I Style', color: '#e76f51', better: 'higher', decimals: 4},
      {key: 'overlapPsnr', label: 'PSNRov', color: '#2a9d8f', better: 'higher', decimals: 4}
    ],
    data: [
      {method: 'DreamHome-Pano', hpsv3: 8.5711, clipStyle: 0.7785, overlapPsnr: 15.4022},
      {method: 'Pano2room', hpsv3: 2.1771, clipStyle: 0.6796, overlapPsnr: 15.7788},
      {method: 'Nano Banana 2', hpsv3: 9.5483, clipStyle: 0.7940, overlapPsnr: 14.7476},
      {method: 'Seedream-4.5-Edit', hpsv3: 7.0733, clipStyle: 0.7829, overlapPsnr: 15.3870},
      {method: 'OmniRoam', hpsv3: 6.1492, clipStyle: 0.7201, overlapPsnr: 16.3862},
      {method: 'PanoWorld', hpsv3: 7.9564, clipStyle: 0.7577, overlapPsnr: 22.1365, highlight: true}
    ]
  },
  {
    containerId: 'reconstruction-8-chart',
    metrics: [
      {key: 'psnr', label: 'PSNR', color: '#355070', better: 'higher', decimals: 4},
      {key: 'ssim', label: 'SSIM', color: '#3a86ff', better: 'higher', decimals: 4},
      {key: 'lpips', label: 'LPIPS', color: '#c0843d', better: 'lower', decimals: 4}
    ],
    data: [
      {method: 'MVP', psnr: 21.0370, ssim: 0.8145, lpips: 0.3044},
      {method: 'Adapt-Splat', psnr: 21.2418, ssim: 0.8195, lpips: 0.2978},
      {method: 'WorldMirror 2.0', psnr: 13.3344, ssim: 0.5402, lpips: 0.5690},
      {method: 'PanoWorld', psnr: 29.2361, ssim: 0.8880, lpips: 0.2225, highlight: true}
    ]
  },
  {
    containerId: 'reconstruction-12-chart',
    metrics: [
      {key: 'psnr', label: 'PSNR', color: '#355070', better: 'higher', decimals: 4},
      {key: 'ssim', label: 'SSIM', color: '#3a86ff', better: 'higher', decimals: 4},
      {key: 'lpips', label: 'LPIPS', color: '#c0843d', better: 'lower', decimals: 4}
    ],
    data: [
      {method: 'MVP', psnr: 20.8342, ssim: 0.8090, lpips: 0.3095},
      {method: 'Adapt-Splat', psnr: 21.5156, ssim: 0.8240, lpips: 0.2906},
      {method: 'WorldMirror 2.0', psnr: 12.7541, ssim: 0.5160, lpips: 0.5943},
      {method: 'PanoWorld', psnr: 28.8003, ssim: 0.8817, lpips: 0.2299, highlight: true}
    ]
  }
];

var quantitativeChartsRendered = false;
var quantitativeResizeTimer = null;

function scheduleIdleTask(callback, timeout) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, {timeout: timeout || 1200});
    return;
  }

  window.setTimeout(callback, timeout || 1200);
}

function escapeSvgText(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatQuantitativeValue(metric, value) {
  return value.toFixed(metric.decimals || 4);
}

function normalizeQuantitativeValue(metric, value, values) {
  var minValue = Math.min.apply(null, values);
  var maxValue = Math.max.apply(null, values);

  if (maxValue === minValue) {
    return 1;
  }

  if (metric.better === 'lower') {
    return (maxValue - value) / (maxValue - minValue);
  }

  return (value - minValue) / (maxValue - minValue);
}

function splitMethodLabel(label) {
  if (label === 'PanoWorld') {
    return ['PanoWorld'];
  }

  if (label.indexOf(' ') !== -1) {
    return label.split(' ');
  }

  if (label.indexOf('-') !== -1) {
    return label.split('-');
  }

  return [label];
}

function renderMethodLabel(svg, centerX, baseY, method, highlight) {
  var lines = splitMethodLabel(method);
  var fontWeight = highlight ? '700' : '500';
  var color = highlight ? '#1f4b6e' : '#3d4451';

  svg.push(
    '<text x="' + centerX + '" y="' + baseY + '" text-anchor="middle" font-size="11.5" fill="' +
    color + '" font-weight="' + fontWeight + '">'
  );

  lines.forEach(function(line, index) {
    svg.push(
      '<tspan x="' + centerX + '" dy="' + (index === 0 ? 0 : 12) + '">' +
      escapeSvgText(line) + '</tspan>'
    );
  });

  svg.push('</text>');
}

function renderQuantitativeChart(config) {
  var container = document.getElementById(config.containerId);
  if (!container) {
    return;
  }

  var bounds = container.getBoundingClientRect();
  var containerWidth = Math.max(320, Math.round(bounds.width || container.clientWidth || 960));
  var metricsPerMethod = config.metrics.length;
  var margins = {top: 74, right: 14, bottom: 82, left: 14};
  var plotHeight = config.data.length > 5 ? 250 : 228;
  var groupGap = config.data.length > 5 ? 18 : 26;
  var barGap = config.data.length > 5 ? 6 : 7;
  var barWidth = config.data.length > 5 ? 20 : 24;
  var groupWidth = metricsPerMethod * barWidth + (metricsPerMethod - 1) * barGap;
  var width = Math.max(
    containerWidth,
    margins.left + margins.right + (config.data.length * groupWidth) + ((config.data.length - 1) * groupGap)
  );
  var innerWidth = width - margins.left - margins.right;
  var usedWidth = config.data.length * groupWidth + (config.data.length - 1) * groupGap;
  var startX = margins.left + Math.max(0, Math.floor((innerWidth - usedWidth) / 2));
  var height = margins.top + plotHeight + margins.bottom;
  var baselineY = margins.top + plotHeight;
  var metricSeries = {};
  var svg = [];

  config.metrics.forEach(function(metric) {
    metricSeries[metric.key] = config.data.map(function(entry) {
      return entry[metric.key];
    });
  });

  svg.push(
    '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' +
    escapeSvgText(config.containerId + ' quantitative chart') + '" style="width:' + width + 'px;">'
  );
  svg.push(
    '<line x1="' + margins.left + '" y1="' + baselineY + '" x2="' + (width - margins.right) +
    '" y2="' + baselineY + '" stroke="#cfd6df" stroke-width="1.5"></line>'
  );

  config.data.forEach(function(entry, methodIndex) {
    var groupX = startX + methodIndex * (groupWidth + groupGap);
    var groupCenter = groupX + groupWidth / 2;

    if (entry.highlight) {
      svg.push(
        '<rect x="' + (groupX - 10) + '" y="' + (margins.top - 14) + '" width="' + (groupWidth + 20) +
        '" height="' + (plotHeight + 30) + '" rx="14" fill="rgba(39, 74, 99, 0.08)" stroke="rgba(39, 74, 99, 0.26)" stroke-dasharray="4 4"></rect>'
      );
    }

    config.metrics.forEach(function(metric, metricIndex) {
      var normalized = normalizeQuantitativeValue(metric, entry[metric.key], metricSeries[metric.key]);
      var barHeight = Math.max(10, plotHeight * normalized);
      var x = groupX + metricIndex * (barWidth + barGap);
      var y = baselineY - barHeight;
      var valueLabel = formatQuantitativeValue(metric, entry[metric.key]);
      var title = entry.method + ' | ' + metric.label + ': ' + valueLabel;

      svg.push(
        '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight +
        '" rx="3" fill="' + metric.color + '" opacity="0.94">' +
        '<title>' + escapeSvgText(title) + '</title></rect>'
      );
      svg.push(
        '<text x="' + (x + barWidth / 2) + '" y="' + (y - 6) + '" text-anchor="end" font-size="9" fill="#5c6370" ' +
        'transform="rotate(-63 ' + (x + barWidth / 2) + ' ' + (y - 6) + ')">' +
        escapeSvgText(valueLabel) + '</text>'
      );
    });

    renderMethodLabel(svg, groupCenter, baselineY + 24, entry.method, entry.highlight);
  });

  svg.push('</svg>');
  container.innerHTML = svg.join('');
}

function renderAllQuantitativeCharts() {
  quantitativeChartsRendered = true;
  QUANTITATIVE_CHART_CONFIGS.forEach(renderQuantitativeChart);
}

function scheduleQuantitativeChartsRender() {
  if (!quantitativeChartsRendered) {
    return;
  }

  if (quantitativeResizeTimer !== null) {
    window.clearTimeout(quantitativeResizeTimer);
  }

  quantitativeResizeTimer = window.setTimeout(function() {
    renderAllQuantitativeCharts();
  }, 120);
}

function setupQuantitativeChartsRendering() {
  var section = document.getElementById('quantitative-comparison');
  if (!section) {
    return;
  }

  function renderOnce() {
    if (!quantitativeChartsRendered) {
      renderAllQuantitativeCharts();
    }
  }

  scheduleIdleTask(renderOnce, 1800);

  if (!('IntersectionObserver' in window)) {
    return;
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        renderOnce();
        observer.disconnect();
      }
    });
  }, {
    rootMargin: '900px 0px',
    threshold: 0.01
  });

  observer.observe(section);
}

function copyTextToClipboard(text) {
  return new Promise(function(resolve, reject) {
    function fallbackCopy() {
      var textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      textArea.style.left = '0';
      textArea.style.top = '0';
      textArea.style.width = '1px';
      textArea.style.height = '1px';
      document.body.appendChild(textArea);

      textArea.focus({preventScroll: true});
      textArea.select();
      textArea.setSelectionRange(0, textArea.value.length);

      try {
        var successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          resolve();
        } else {
          reject(new Error('Copy command was unsuccessful.'));
        }
      } catch (error) {
        document.body.removeChild(textArea);
        reject(error);
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(resolve).catch(function() {
        fallbackCopy();
      });
      return;
    }

    fallbackCopy();
  });
}

function setupBibtexCopy() {
  var copyButton = document.getElementById('copy-bibtex-button');
  var copyLabel = document.getElementById('copy-bibtex-label');
  var bibtexBlock = document.getElementById('bibtex-content');

  if (!copyButton || !copyLabel || !bibtexBlock) {
    return;
  }

  var defaultText = 'Copy BibTeX';
  var bibtexCode = bibtexBlock.querySelector('code');

  copyButton.addEventListener('click', function(event) {
    event.preventDefault();
    var bibtexText = bibtexCode ? bibtexCode.innerText : bibtexBlock.innerText;

    copyTextToClipboard(bibtexText).then(function() {
      copyLabel.textContent = 'Copied';
      window.setTimeout(function() {
        copyLabel.textContent = defaultText;
      }, 1600);
    }).catch(function() {
      copyLabel.textContent = 'Copy Failed';
      window.setTimeout(function() {
        copyLabel.textContent = defaultText;
      }, 1800);
    });
  });
}

function primeCarouselVideo(video) {
  if (!video || video.dataset.loaded === 'true') {
    return;
  }

  var sources = Array.prototype.slice.call(video.querySelectorAll('source[data-src]'));
  if (!sources.length) {
    return;
  }

  sources.forEach(function(source) {
    source.src = source.dataset.src;
  });
  video.dataset.loaded = 'true';
  video.preload = 'auto';
  video.load();
}

function playCarouselVideo(video) {
  if (!video) {
    return;
  }

  primeCarouselVideo(video);
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');

  var playPromise = video.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(function() {});
  }
}

function pauseCarouselVideo(video) {
  if (video && !video.paused) {
    video.pause();
  }
}

function setupLazyCarouselVideosForCarousel(carousel) {
  var videos = Array.prototype.slice.call(carousel.querySelectorAll('.lazy-carousel-video'));

  if (!carousel || !videos.length) {
    return;
  }

  var isCarouselNearViewport = false;
  var preloadScheduled = false;

  function scheduleCarouselPreload() {
    if (preloadScheduled) {
      return;
    }

    preloadScheduled = true;

    scheduleIdleTask(function() {
      videos.forEach(function(video, index) {
        window.setTimeout(function() {
          primeCarouselVideo(video);
        }, index * 350);
      });
    }, 450);
  }

  function syncCarouselPlayback() {
    carousel.dataset.shouldPlay = (isCarouselNearViewport && !document.hidden) ? 'true' : 'false';

    if (carousel.dataset.shouldPlay === 'true') {
      videos.forEach(primeCarouselVideo);
      videos.forEach(playCarouselVideo);
    } else {
      videos.forEach(pauseCarouselVideo);
    }
  }

  videos.forEach(function(video) {
    video.addEventListener('canplay', function() {
      if (carousel.dataset.shouldPlay === 'true') {
        playCarouselVideo(video);
      }
    });
  });

  scheduleCarouselPreload();

  if (!('IntersectionObserver' in window)) {
    isCarouselNearViewport = true;
    syncCarouselPlayback();
    return;
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      isCarouselNearViewport = entry.isIntersecting;
      syncCarouselPlayback();
    });
  }, {
    rootMargin: '900px 0px',
    threshold: 0.15
  });

  observer.observe(carousel);

  document.addEventListener('visibilitychange', function() {
    syncCarouselPlayback();
  });
}

function setupVideoCarousels() {
  var carousels = Array.prototype.slice.call(document.querySelectorAll('.results-carousel[data-video-carousel="true"]'));

  if (!carousels.length) {
    return;
  }

  carousels.forEach(function(carousel) {
    var resultItems = carousel.querySelectorAll('.item');
    var visibleSlides = Math.min(3, resultItems.length);
    var options = {
      slidesToScroll: 1,
      slidesToShow: visibleSlides,
      loop: resultItems.length > visibleSlides,
      infinite: resultItems.length > visibleSlides,
      autoplay: false,
      autoplaySpeed: 3000
    };

    if (resultItems.length <= 1) {
      carousel.classList.remove('carousel');
      carousel.classList.add('is-static');
    } else if (window.bulmaCarousel && typeof bulmaCarousel.attach === 'function') {
      bulmaCarousel.attach(carousel, options);
    }

    if (carousel.classList.contains('is-static') || carousel.querySelector('.slider-container')) {
      carousel.classList.add('is-carousel-ready');
    }

    setupLazyCarouselVideosForCarousel(carousel);
  });
}

function setupResearchDropdown() {
  var dropdown = document.querySelector('.top-showcase .navbar-item.has-dropdown');
  if (!dropdown) {
    return;
  }

  var trigger = dropdown.querySelector('.navbar-link');
  var hideTimer = null;

  function clearHideTimer() {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function openDropdown() {
    clearHideTimer();
    dropdown.classList.add('is-active');
  }

  function closeDropdown() {
    clearHideTimer();
    hideTimer = window.setTimeout(function() {
      dropdown.classList.remove('is-active');
    }, 120);
  }

  dropdown.addEventListener('mouseenter', openDropdown);
  dropdown.addEventListener('mouseleave', closeDropdown);
  dropdown.addEventListener('focusin', openDropdown);
  dropdown.addEventListener('focusout', function(event) {
    if (!dropdown.contains(event.relatedTarget)) {
      closeDropdown();
    }
  });

  if (trigger) {
    trigger.addEventListener('click', function(event) {
      event.preventDefault();
      clearHideTimer();
      dropdown.classList.toggle('is-active');
    });
  }

  document.addEventListener('click', function(event) {
    if (!dropdown.contains(event.target)) {
      clearHideTimer();
      dropdown.classList.remove('is-active');
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'));
  navbarBurgers.forEach(function(burger) {
    burger.addEventListener('click', function() {
      Array.prototype.slice.call(document.querySelectorAll('.navbar-burger, .navbar-menu')).forEach(function(element) {
        element.classList.toggle('is-active');
      });
    });
  });

  setupResearchDropdown();
  setupVideoCarousels();
  setupQuantitativeChartsRendering();
  setupBibtexCopy();
  window.addEventListener('resize', scheduleQuantitativeChartsRender);
});
