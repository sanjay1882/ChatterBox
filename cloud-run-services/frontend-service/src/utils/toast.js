// lightweight toast utility used by React components
export default function showToast(message, type = 'success') {
    const existingCount = document.querySelectorAll('.toast').length;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.top = `${20 + (existingCount * 70)}px`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Force reflow
    toast.offsetHeight;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 500);
    }, 4000);
}