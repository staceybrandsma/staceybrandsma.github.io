/**
 * Tab Controller - Handles tab navigation and keyboard interactions
 */
export class TabController {
    constructor() {
        this.setupEventListeners();
        this.setupKeyboardNavigation();
    }

    setupEventListeners() {
        // Add click listeners to all tab buttons
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = this.getTabNameFromButton(button);
                if (tabName) {
                    this.openTab(e, tabName);
                }
            });
        });
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            const tabs = document.querySelectorAll('.tab-button');
            const currentTab = document.querySelector('.tab-button.active');
            const currentIndex = Array.from(tabs).indexOf(currentTab);
            
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
                tabs[currentIndex - 1].click();
            } else if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
                tabs[currentIndex + 1].click();
            }
        });
    }

    getTabNameFromButton(button) {
        // Extract tab name from onclick attribute or data attribute
        const onclickAttr = button.getAttribute('onclick');
        if (onclickAttr) {
            const match = onclickAttr.match(/openTab\(event,\s*['"]([^'"]+)['"]\)/);
            return match ? match[1] : null;
        }
        return button.getAttribute('data-tab') || null;
    }

    openTab(evt, tabName) {
        // Hide all tab content
        const tabContent = document.getElementsByClassName("tab-content");
        for (let i = 0; i < tabContent.length; i++) {
            tabContent[i].classList.remove("active");
        }
        
        // Remove active class from all tab buttons
        const tabLinks = document.getElementsByClassName("tab-button");
        for (let i = 0; i < tabLinks.length; i++) {
            tabLinks[i].classList.remove("active");
        }
        
        // Show the selected tab content and mark button as active
        const targetTab = document.getElementById(tabName);
        if (targetTab) {
            targetTab.classList.add("active");
        }
        
        if (evt && evt.currentTarget) {
            evt.currentTarget.classList.add("active");
        }
    }
}

// Global function for backward compatibility with existing HTML
window.openTab = function(evt, tabName) {
    const controller = new TabController();
    controller.openTab(evt, tabName);
};
