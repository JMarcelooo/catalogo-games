(function (global) {
  'use strict';

  function fillPercent(rating, index) {
    const fill = rating - (index - 1);
    return Math.max(0, Math.min(1, fill)) * 100;
  }

  function render(container, options) {
    const opts = options || {};
    let rating = typeof opts.rating === 'number' ? opts.rating : 0;
    const interactive = Boolean(opts.interactive);
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
    const starEls = [];

    container.classList.add('stars');
    if (interactive) container.classList.add('stars-interactive');

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = 'star';
      star.dataset.index = String(i);

      const empty = document.createElement('span');
      empty.className = 'star-char star-empty';
      empty.textContent = '★';

      const fill = document.createElement('span');
      fill.className = 'star-char star-fill';
      fill.textContent = '★';

      star.appendChild(empty);
      star.appendChild(fill);
      container.appendChild(star);
      starEls.push(star);
    }

    function paint(value) {
      starEls.forEach(function (star, i) {
        star.querySelector('.star-fill').style.width = fillPercent(value, i + 1) + '%';
      });
      if (interactive) {
        container.setAttribute('role', 'slider');
        container.setAttribute('aria-valuemin', '0');
        container.setAttribute('aria-valuemax', '5');
        container.setAttribute('aria-valuenow', String(value));
        container.tabIndex = 0;
      } else {
        container.setAttribute('role', 'img');
      }
      container.setAttribute('aria-label', 'Nota: ' + value + ' de 5');
    }

    function ratingFromEvent(star, event) {
      const rect = star.getBoundingClientRect();
      const onLeftHalf = event.clientX < rect.left + rect.width / 2;
      const index = Number(star.dataset.index);
      return onLeftHalf ? index - 0.5 : index;
    }

    if (interactive) {
      container.addEventListener('mousemove', function (event) {
        const star = event.target.closest('.star');
        if (!star) return;
        paint(ratingFromEvent(star, event));
      });

      container.addEventListener('mouseleave', function () {
        paint(rating);
      });

      container.addEventListener('click', function (event) {
        const star = event.target.closest('.star');
        if (!star) return;
        rating = ratingFromEvent(star, event);
        paint(rating);
        if (onChange) onChange(rating);
      });

      container.addEventListener('keydown', function (event) {
        let next = null;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, rating - 0.5);
        else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(5, rating + 0.5);
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = 5;
        if (next === null) return;
        event.preventDefault();
        rating = next;
        paint(rating);
        if (onChange) onChange(rating);
      });
    }

    paint(rating);

    return {
      get rating() {
        return rating;
      },
      set(value) {
        rating = value;
        paint(rating);
      },
    };
  }

  global.Stars = { render: render };
})(window);
