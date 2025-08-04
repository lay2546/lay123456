export function formatThaiDateTime(date) {
  return date.toLocaleString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

export function showNotification(msg, type = 'info') {
  const div = document.createElement('div');
  div.textContent = msg;
  div.className = `fixed top-4 right-4 bg-${type === 'error' ? 'red' : 'green'}-500 text-white px-4 py-2 rounded shadow z-50`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}