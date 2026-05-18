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
});
