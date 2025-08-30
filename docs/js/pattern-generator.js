/**
 * Pattern Generator - Converts images to knitting/cross-stitch patterns using k-means clustering
 */
export class PatternGenerator {
    constructor() {
        this.originalImage = null;
        this.currentPatternData = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const imageInput = document.getElementById('imageInput');
        const generateBtn = document.getElementById('generatePattern');

        if (!uploadArea || !imageInput || !generateBtn) return;

        // File upload handling
        uploadArea.addEventListener('click', () => imageInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        imageInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Control updates
        const widthSlider = document.getElementById('stitchWidth');
        const heightSlider = document.getElementById('stitchHeight');
        const colorSlider = document.getElementById('colorCount');

        if (widthSlider) {
            widthSlider.addEventListener('input', () => {
                if (this.originalImage) {
                    this.updateHeightFromWidth();
                }
            });
        }

        if (colorSlider) {
            colorSlider.addEventListener('input', (e) => {
                const colorValue = document.getElementById('colorValue');
                if (colorValue) {
                    colorValue.textContent = e.target.value;
                }
            });
        }

        generateBtn.addEventListener('click', this.generatePattern.bind(this));

        // Export button listeners
        this.setupExportListeners();
    }

    setupExportListeners() {
        const exportImageBtn = document.getElementById('exportImage');
        const exportChartBtn = document.getElementById('exportChart');
        const exportPaletteBtn = document.getElementById('exportPalette');

        if (exportImageBtn) {
            exportImageBtn.addEventListener('click', this.exportPatternImage.bind(this));
        }
        if (exportChartBtn) {
            exportChartBtn.addEventListener('click', this.exportTextChart.bind(this));
        }
        if (exportPaletteBtn) {
            exportPaletteBtn.addEventListener('click', this.exportColorGuide.bind(this));
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.showImagePreview(e.target.result);
                this.showControls();
                this.calculateHeightFromAspectRatio(img);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    showImagePreview(imageSrc) {
        const previewSection = document.getElementById('imagePreview');
        const previewImage = document.getElementById('previewImage');
        
        if (previewSection && previewImage) {
            previewImage.src = imageSrc;
            previewSection.style.display = 'block';
        }
    }

    showControls() {
        const controlsSection = document.getElementById('controlsSection');
        if (controlsSection) {
            controlsSection.style.display = 'block';
        }
    }

    calculateHeightFromAspectRatio(img) {
        const defaultWidth = 100; // Default width at 100 stitches
        const aspectRatio = img.height / img.width;
        const calculatedHeight = Math.round(defaultWidth * aspectRatio);
        
        // Ensure height is within reasonable bounds
        const minHeight = 10;
        const maxHeight = 200;
        const clampedHeight = Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
        
        // Set the height input value
        const heightInput = document.getElementById('stitchHeight');
        if (heightInput) {
            heightInput.value = clampedHeight;
        }
    }

    updateHeightFromWidth() {
        if (!this.originalImage) return;
        
        const widthInput = document.getElementById('stitchWidth');
        const heightInput = document.getElementById('stitchHeight');
        
        if (widthInput && heightInput) {
            const currentWidth = parseInt(widthInput.value);
            const aspectRatio = this.originalImage.height / this.originalImage.width;
            const calculatedHeight = Math.round(currentWidth * aspectRatio);
            
            // Ensure height is within reasonable bounds
            const minHeight = 10;
            const maxHeight = 200;
            const clampedHeight = Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
            
            heightInput.value = clampedHeight;
        }
    }

    generatePattern() {
        if (!this.originalImage) return;

        const stitchWidth = parseInt(document.getElementById('stitchWidth').value);
        const stitchHeight = parseInt(document.getElementById('stitchHeight').value);
        const colorCount = parseInt(document.getElementById('colorCount').value);

        // Create pattern
        const patternData = this.createPattern(stitchWidth, stitchHeight, colorCount);
        this.currentPatternData = patternData; // Store for export
        this.displayPattern(patternData, stitchWidth, stitchHeight);
        this.displayColorPalette(patternData.palette);
        
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }
    }

    createPattern(width, height, colorCount) {
        // Create a temporary canvas to resize the image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        // Draw resized image
        tempCtx.drawImage(this.originalImage, 0, 0, width, height);
        
        // Get pixel data
        const imageData = tempCtx.getImageData(0, 0, width, height);
        const pixels = [];
        
        for (let i = 0; i < imageData.data.length; i += 4) {
            pixels.push([
                imageData.data[i],     // R
                imageData.data[i + 1], // G
                imageData.data[i + 2]  // B
            ]);
        }
        
        // Simple k-means clustering for color reduction
        const palette = this.kMeansClustering(pixels, colorCount);
        const quantizedPixels = this.quantizePixels(pixels, palette);
        
        return {
            pixels: quantizedPixels,
            palette: palette,
            width: width,
            height: height
        };
    }

    kMeansClustering(pixels, k) {
        // Initialize centroids randomly
        let centroids = [];
        for (let i = 0; i < k; i++) {
            const randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
            centroids.push([...randomPixel]);
        }
        
        // Iterate to find optimal centroids
        for (let iter = 0; iter < 20; iter++) {
            const clusters = Array.from({ length: k }, () => []);
            
            // Assign pixels to nearest centroid
            pixels.forEach(pixel => {
                let minDist = Infinity;
                let closestCentroid = 0;
                
                centroids.forEach((centroid, idx) => {
                    const dist = this.colorDistance(pixel, centroid);
                    if (dist < minDist) {
                        minDist = dist;
                        closestCentroid = idx;
                    }
                });
                
                clusters[closestCentroid].push(pixel);
            });
            
            // Update centroids
            centroids = clusters.map(cluster => {
                if (cluster.length === 0) return centroids[0];
                
                const avgR = cluster.reduce((sum, p) => sum + p[0], 0) / cluster.length;
                const avgG = cluster.reduce((sum, p) => sum + p[1], 0) / cluster.length;
                const avgB = cluster.reduce((sum, p) => sum + p[2], 0) / cluster.length;
                
                return [Math.round(avgR), Math.round(avgG), Math.round(avgB)];
            });
        }
        
        return centroids;
    }

    colorDistance(color1, color2) {
        const dr = color1[0] - color2[0];
        const dg = color1[1] - color2[1];
        const db = color1[2] - color2[2];
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    quantizePixels(pixels, palette) {
        return pixels.map(pixel => {
            let minDist = Infinity;
            let closestColor = palette[0];
            
            palette.forEach(color => {
                const dist = this.colorDistance(pixel, color);
                if (dist < minDist) {
                    minDist = dist;
                    closestColor = color;
                }
            });
            
            return closestColor;
        });
    }

    displayPattern(patternData, width, height) {
        const canvas = document.getElementById('patternCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        const cellSize = Math.min(300 / width, 300 / height);
        canvas.width = width * cellSize;
        canvas.height = height * cellSize;
        
        // Draw pattern with grid
        patternData.pixels.forEach((color, index) => {
            const x = (index % width) * cellSize;
            const y = Math.floor(index / width) * cellSize;
            
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fillRect(x, y, cellSize, cellSize);
            
            // Draw grid
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x, y, cellSize, cellSize);
        });
    }

    displayColorPalette(palette) {
        const container = document.getElementById('paletteColors');
        if (!container) return;
        
        container.innerHTML = '';
        
        palette.forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            swatch.textContent = index + 1;
            container.appendChild(swatch);
        });
    }

    // Export Functions
    exportPatternImage() {
        if (!this.currentPatternData) {
            alert('Please generate a pattern first!');
            return;
        }

        const canvas = document.getElementById('patternCanvas');
        if (!canvas) return;

        // Create high-resolution version for export
        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');
        
        const cellSize = 20; // Larger cells for better quality
        const width = this.currentPatternData.width;
        const height = this.currentPatternData.height;
        
        exportCanvas.width = width * cellSize;
        exportCanvas.height = height * cellSize;
        
        // Draw pattern with grid
        this.currentPatternData.pixels.forEach((color, index) => {
            const x = (index % width) * cellSize;
            const y = Math.floor(index / width) * cellSize;
            
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fillRect(x, y, cellSize, cellSize);
            
            // Draw grid
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cellSize, cellSize);
        });

        // Download the image
        this.downloadCanvas(exportCanvas, 'knitting-pattern.png');
    }

    exportTextChart() {
        if (!this.currentPatternData) {
            alert('Please generate a pattern first!');
            return;
        }

        const width = this.currentPatternData.width;
        const height = this.currentPatternData.height;
        const palette = this.currentPatternData.palette;
        
        // Create color to symbol mapping
        const symbols = ['⬜', '⬛', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⚫', '⚪', '🔴'];
        const colorMap = new Map();
        
        palette.forEach((color, index) => {
            const colorKey = `${color[0]},${color[1]},${color[2]}`;
            colorMap.set(colorKey, {
                symbol: symbols[index] || `${index + 1}`,
                number: index + 1
            });
        });

        // Generate text chart
        let chartText = `KNITTING/CROSS-STITCH PATTERN\n`;
        chartText += `Size: ${width} x ${height} stitches\n`;
        chartText += `Generated: ${new Date().toLocaleDateString()}\n\n`;
        
        chartText += `COLOR LEGEND:\n`;
        palette.forEach((color, index) => {
            const symbol = symbols[index] || `${index + 1}`;
            chartText += `${symbol} = Color ${index + 1} - RGB(${color[0]}, ${color[1]}, ${color[2]})\n`;
        });
        chartText += `\n`;

        chartText += `PATTERN CHART:\n`;
        chartText += `Read from bottom to top, right to left for knitting\n`;
        chartText += `Read from top to bottom, left to right for cross-stitch\n\n`;
        
        // Add row numbers and pattern
        for (let y = 0; y < height; y++) {
            const rowNum = (height - y).toString().padStart(3, ' ');
            chartText += `${rowNum}: `;
            
            for (let x = 0; x < width; x++) {
                const pixelIndex = y * width + x;
                const color = this.currentPatternData.pixels[pixelIndex];
                const colorKey = `${color[0]},${color[1]},${color[2]}`;
                const mapping = colorMap.get(colorKey);
                chartText += mapping ? mapping.symbol : '?';
            }
            chartText += `\n`;
        }

        // Download as text file
        this.downloadText(chartText, 'knitting-pattern-chart.txt');
    }

    exportColorGuide() {
        if (!this.currentPatternData) {
            alert('Please generate a pattern first!');
            return;
        }

        const palette = this.currentPatternData.palette;
        
        let guideText = `COLOR GUIDE FOR KNITTING/CROSS-STITCH PATTERN\n`;
        guideText += `Generated: ${new Date().toLocaleDateString()}\n\n`;
        
        guideText += `YARN/THREAD COLOR RECOMMENDATIONS:\n`;
        guideText += `(Use these RGB values to match with your preferred yarn/thread brand)\n\n`;
        
        palette.forEach((color, index) => {
            guideText += `Color ${index + 1}:\n`;
            guideText += `  RGB: ${color[0]}, ${color[1]}, ${color[2]}\n`;
            guideText += `  Hex: #${color[0].toString(16).padStart(2, '0')}${color[1].toString(16).padStart(2, '0')}${color[2].toString(16).padStart(2, '0')}\n`;
            guideText += `  Yarn brand: ________________\n`;
            guideText += `  Color name: ________________\n`;
            guideText += `  Amount needed: ____________\n\n`;
        });

        guideText += `PATTERN NOTES:\n`;
        guideText += `• Pattern size: ${this.currentPatternData.width} x ${this.currentPatternData.height} stitches\n`;
        guideText += `• Total colors: ${palette.length}\n`;
        guideText += `• For knitting: Work from bottom up, reading chart right to left\n`;
        guideText += `• For cross-stitch: Work from top down, reading chart left to right\n`;
        guideText += `• Consider yarn weight and needle/fabric size for final dimensions\n`;

        this.downloadText(guideText, 'color-guide.txt');
    }

    downloadCanvas(canvas, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL();
        link.click();
    }

    downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }
}
