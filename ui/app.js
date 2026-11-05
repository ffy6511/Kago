(async () => {
const response = await fetch('./api/health', {headers: {'x-skill-workspaces-token': document.querySelector('meta[name="page-token"]').content}});
document.getElementById('status').textContent = response.ok ? 'Local plugin host connected' : 'Connection failed';

})();
