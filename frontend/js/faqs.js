// === FAQ Accordion ===
function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isActive = item.classList.contains('active');
      
      // Close all
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      
      // Open clicked if it wasn't active
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}
 
