// Sidebar toggle for mobile
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('.sidebar-overlay').classList.toggle('open');
}

// Set active nav item based on current path
function setActiveNav() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item a').forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '/' && href === '/')) {
      link.classList.add('active');
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  
  // Close sidebar on mobile when clicking overlay
  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', toggleSidebar);
  }
});
