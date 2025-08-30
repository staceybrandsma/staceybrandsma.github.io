/**
 * Main Application Entry Point
 * Initializes all components when the DOM is loaded
 */
import { TabController } from './tab-controller.js';
import { PatternGenerator } from './pattern-generator.js';

class App {
    constructor() {
        this.tabController = null;
        this.patternGenerator = null;
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeComponents();
            });
        } else {
            this.initializeComponents();
        }
    }

    initializeComponents() {
        try {
            // Initialize tab controller
            this.tabController = new TabController();
            console.log('Tab controller initialized');

            // Initialize pattern generator
            this.patternGenerator = new PatternGenerator();
            console.log('Pattern generator initialized');

        } catch (error) {
            console.error('Error initializing application:', error);
        }
    }
}

// Initialize the application
new App();
