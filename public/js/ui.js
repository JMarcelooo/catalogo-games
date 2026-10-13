(function (global) {
  'use strict';

  function toastRoot() {
    let root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      root.className = 'toast-root';
      root.setAttribute('aria-live', 'polite');
      document.body.appendChild(root);
    }
    return root;
  }

  function toast(message, type) {
    const kind = type || 'info';
    const node = document.createElement('div');
    node.className = 'toast toast-' + kind;
    node.setAttribute('role', 'status');

    const bar = document.createElement('span');
    bar.className = 'toast-bar';

    const text = document.createElement('span');
    text.textContent = message;

    node.appendChild(bar);
    node.appendChild(text);
    toastRoot().appendChild(node);

    setTimeout(function () {
      node.classList.add('leaving');
      node.addEventListener('animationend', function () {
        node.remove();
      }, { once: true });
    }, 3200);
  }

  function confirm(options) {
    const opts = options || {};
    return new Promise(function (resolve) {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.setAttribute('role', 'alertdialog');
      modal.setAttribute('aria-modal', 'true');

      const title = document.createElement('h3');
      title.textContent = opts.title || 'Tem certeza?';

      const message = document.createElement('p');
      message.textContent = opts.message || '';

      const actions = document.createElement('div');
      actions.className = 'modal-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-ghost';
      cancelBtn.textContent = opts.cancelText || 'Cancelar';

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger');
      confirmBtn.textContent = opts.confirmText || 'Confirmar';

      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      modal.appendChild(title);
      modal.appendChild(message);
      modal.appendChild(actions);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      confirmBtn.focus();

      function close(result) {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        resolve(result);
      }

      function onKey(event) {
        if (event.key === 'Escape') close(false);
      }

      cancelBtn.addEventListener('click', function () { close(false); });
      confirmBtn.addEventListener('click', function () { close(true); });
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) close(false);
      });
      document.addEventListener('keydown', onKey);
    });
  }

  global.UI = { toast: toast, confirm: confirm };
})(window);
