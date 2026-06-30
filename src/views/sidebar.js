export function initSidebar(role, onTabChange) {
  const sidebar = document.querySelector(`#${role}-section .dashboard-sidebar`);
  if (!sidebar) return;

  const navItems = sidebar.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll(`#${role}-section .tab-content`);

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active states
      navItems.forEach(nav => nav.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active state to clicked item
      item.classList.add('active');
      const targetTabId = item.dataset.tab;
      
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      if (onTabChange) {
        onTabChange(targetTabId);
      }
    });
  });
}
