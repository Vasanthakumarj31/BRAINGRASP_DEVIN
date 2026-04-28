// === About Toggle ===
function initAboutToggle() {
  const toggle = document.getElementById('aboutToggle');
  const content = document.getElementById('aboutContent');
  if (!toggle || !content) return;
 
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('collapsed');
    content.classList.toggle('hidden');
  });
}
 
