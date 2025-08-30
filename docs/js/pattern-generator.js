/**
 * Pattern Generator - Converts images to knitting/cross-stitch patterns using k-means clustering
 */
export class PatternGenerator {
    constructor() {
        this.originalImage = null;
        this.currentPatternData = null;
        this.isEditMode = false;
        this.selectedEditColor = null;
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
        const colorInput = document.getElementById('colorCount');
        const craftType = document.getElementById('craftType');

        // Color count input doesn't need real-time updates since we removed auto-regeneration
        // The value will be read when Generate Pattern is clicked

        // Setup measurement inputs (always active now)
        this.setupMeasurementInputs();

        // Craft type handling
        if (craftType) {
            craftType.addEventListener('change', this.handleCraftTypeChange.bind(this));
            this.handleCraftTypeChange(); // Initialize on load
        }

        // Fabric count changes should keep measurements constant
        const fabricCount = document.getElementById('fabricCount');
        if (fabricCount) {
            fabricCount.addEventListener('input', () => {
                // Keep measurements constant, recalculate stitch count based on new fabric count
                this.updateStitchesFromMeasurements();
            });
        }

        // Strand count changes for material calculations
        const strandCount = document.getElementById('strandCount');
        if (strandCount) {
            strandCount.addEventListener('input', () => {
                // No automatic regeneration, just update for next generation
            });
        }
        
        // Gauge changes should keep measurements constant
        const yarnGauge = document.getElementById('yarnGauge');
        if (yarnGauge) {
            yarnGauge.addEventListener('input', () => {
                // Keep measurements constant, recalculate stitch count based on new gauge
                this.updateStitchesFromMeasurements();
            });
        }

        // Yarn weight changes should sync with gauge
        const yarnWeight = document.getElementById('yarnWeight');
        if (yarnWeight && yarnGauge) {
            yarnWeight.addEventListener('change', (e) => {
                const selectedOption = e.target.selectedOptions[0];
                const gauge = selectedOption.getAttribute('data-gauge');
                if (gauge) {
                    yarnGauge.value = gauge;
                    // Keep measurements constant, recalculate stitch count based on new gauge
                    this.updateStitchesFromMeasurements();
                }
            });
        }

        generateBtn.addEventListener('click', this.generatePattern.bind(this));

        // Edit mode toggle
        this.setupEditModeToggle();

        // Export button listeners
        this.setupExportListeners();
    }

    handleCraftTypeChange() {
        const craftType = document.getElementById('craftType').value;
        const yarnControls = document.getElementById('yarnControls');
        const threadControls = document.getElementById('threadControls');
        const fabricControls = document.getElementById('fabricControls');
        const gaugeControls = document.getElementById('gaugeControls');
        
        // Show/hide controls based on craft type
        if (['knitting', 'crochet'].includes(craftType)) {
            // Yarn-based crafts
            yarnControls.style.display = 'flex';
            threadControls.style.display = 'none';
            fabricControls.style.display = 'none';
            gaugeControls.style.display = 'flex';
        } else {
            // Fabric-based crafts (cross-stitch, embroidery, tapestry)
            yarnControls.style.display = 'none';
            threadControls.style.display = 'flex';
            fabricControls.style.display = 'flex';
            gaugeControls.style.display = 'none';
        }
        
        // Update pattern title
        const patternTitle = document.querySelector('.pattern-image h4');
        if (patternTitle) {
            const craftNames = {
                'knitting': 'Knitting',
                'cross-stitch': 'Cross-Stitch',
                'embroidery': 'Embroidery',
                'crochet': 'Crochet',
                'tapestry': 'Tapestry/Needlepoint'
            };
            patternTitle.textContent = `Generated ${craftNames[craftType]} Pattern`;
        }
        
        // Update measurements when craft type changes (affects gauge/fabric count)
        this.updateMeasurementsFromStitches();
    }

    setupMeasurementInputs() {
        const finishedWidth = document.getElementById('finishedWidth');
        const finishedHeight = document.getElementById('finishedHeight');
        
        // Width input
        if (finishedWidth) {
            finishedWidth.addEventListener('input', (e) => {
                this.updateStitchesFromMeasurements();
                if (this.originalImage) {
                    this.updateHeightFromWidth();
                }
            });
        }
        
        // Height input
        if (finishedHeight) {
            finishedHeight.addEventListener('input', (e) => {
                this.updateStitchesFromMeasurements();
            });
        }
        
        // Initialize measurements based on current stitch counts
        this.updateMeasurementsFromStitches();
    }

    updateStitchesFromMeasurements() {
        const finishedWidth = parseFloat(document.getElementById('finishedWidth').value);
        const finishedHeight = parseFloat(document.getElementById('finishedHeight').value);
        const craftType = document.getElementById('craftType').value;
        
        let stitchesPerInch;
        if (['knitting', 'crochet'].includes(craftType)) {
            stitchesPerInch = parseFloat(document.getElementById('yarnGauge').value);
        } else {
            stitchesPerInch = parseInt(document.getElementById('fabricCount').value);
        }
        
        if (!isNaN(finishedWidth) && !isNaN(finishedHeight) && stitchesPerInch) {
            // Input is in inches, gauge is in stitches per inch
            const stitchWidth = Math.round(finishedWidth * stitchesPerInch);
            const stitchHeight = Math.round(finishedHeight * stitchesPerInch);
            
            // Update hidden stitch inputs (clamped to min/max values)
            document.getElementById('stitchWidth').value = Math.max(10, Math.min(200, stitchWidth));
            document.getElementById('stitchHeight').value = Math.max(10, Math.min(200, stitchHeight));
        }
    }

    updateMeasurementsFromStitches() {
        const stitchWidth = parseInt(document.getElementById('stitchWidth').value);
        const stitchHeight = parseInt(document.getElementById('stitchHeight').value);
        const craftType = document.getElementById('craftType').value;
        
        let stitchesPerInch;
        if (['knitting', 'crochet'].includes(craftType)) {
            stitchesPerInch = parseFloat(document.getElementById('yarnGauge').value);
        } else {
            stitchesPerInch = parseInt(document.getElementById('fabricCount').value);
        }
        
        if (stitchWidth && stitchHeight && stitchesPerInch) {
            // Gauge is in stitches per inch, calculate inches directly
            const widthInches = (stitchWidth / stitchesPerInch).toFixed(1);
            const heightInches = (stitchHeight / stitchesPerInch).toFixed(1);
            
            // Update display with inch values
            document.getElementById('finishedWidth').value = widthInches;
            document.getElementById('finishedHeight').value = heightInches;
        }
    }

    setupEditModeToggle() {
        const editModeToggle = document.getElementById('editModeToggle');
        const editInstructions = document.getElementById('editModeInstructions');
        const editColorPalette = document.getElementById('editColorPalette');
        const addColorSection = document.getElementById('addColorSection');

        console.log('Setting up edit mode toggle. Button found:', !!editModeToggle);

        if (editModeToggle) {
            editModeToggle.addEventListener('click', () => {
                console.log('Edit mode toggle clicked. Current state:', this.isEditMode);
                this.isEditMode = !this.isEditMode;
                console.log('New edit mode state:', this.isEditMode);
                
                if (this.isEditMode) {
                    editModeToggle.textContent = 'Exit Edit Mode';
                    editModeToggle.classList.add('active');
                    if (editInstructions) editInstructions.style.display = 'block';
                    if (editColorPalette) editColorPalette.style.display = 'flex';
                    if (addColorSection) addColorSection.style.display = 'flex';
                    this.setupEditColorPalette();
                    this.setupAddColorButton();
                } else {
                    editModeToggle.textContent = 'Enable Edit Mode';
                    editModeToggle.classList.remove('active');
                    if (editInstructions) editInstructions.style.display = 'none';
                    if (editColorPalette) editColorPalette.style.display = 'none';
                    if (addColorSection) addColorSection.style.display = 'none';
                    this.selectedEditColor = null;
                    
                    // Update material estimates when exiting edit mode
                    console.log('Exiting edit mode - updating material estimates');
                    this.calculateAndDisplayMaterials(
                        this.currentPatternData, 
                        this.currentPatternData.width, 
                        this.currentPatternData.height
                    );
                }
                
                // Update canvas styling
                this.updateCanvasStyle();
            });
        }
    }

    setupEditColorPalette() {
        if (!this.currentPatternData || !this.currentPatternData.palette) return;

        const editColorPalette = document.getElementById('editColorPalette');
        if (!editColorPalette) return;

        editColorPalette.innerHTML = '';

        this.currentPatternData.palette.forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'edit-color-swatch';
            swatch.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            swatch.textContent = index + 1;
            swatch.title = `Color ${index + 1} - RGB(${color.join(', ')})`;

            // Check if this is the currently selected color
            if (this.selectedEditColor && 
                color[0] === this.selectedEditColor[0] && 
                color[1] === this.selectedEditColor[1] && 
                color[2] === this.selectedEditColor[2]) {
                swatch.classList.add('selected');
            }

            swatch.addEventListener('click', () => {
                // Remove selection from all swatches
                editColorPalette.querySelectorAll('.edit-color-swatch').forEach(s => 
                    s.classList.remove('selected'));
                
                // Select this swatch
                swatch.classList.add('selected');
                this.selectedEditColor = [...color];
                console.log('Selected edit color:', this.selectedEditColor);
            });

            // Add double-click to edit the color throughout the pattern
            swatch.addEventListener('dblclick', () => {
                this.openColorEditor(index, color);
            });

            editColorPalette.appendChild(swatch);
        });

        // Auto-select the first color if none is selected
        if (!this.selectedEditColor && this.currentPatternData.palette.length > 0) {
            const firstSwatch = editColorPalette.querySelector('.edit-color-swatch');
            if (firstSwatch) {
                firstSwatch.classList.add('selected');
                this.selectedEditColor = [...this.currentPatternData.palette[0]];
            }
        }
    }

    setupAddColorButton() {
        const addColorBtn = document.getElementById('addColorBtn');
        const newColorPicker = document.getElementById('newColorPicker');

        if (addColorBtn && newColorPicker) {
            // Remove any existing listeners to avoid duplicates
            const newAddColorBtn = addColorBtn.cloneNode(true);
            addColorBtn.parentNode.replaceChild(newAddColorBtn, addColorBtn);

            newAddColorBtn.addEventListener('click', () => {
                const hexColor = newColorPicker.value;
                const rgbColor = this.hexToRgb(hexColor);
                
                console.log('Adding new color:', hexColor, rgbColor);
                
                // Check if color already exists in palette
                const colorExists = this.currentPatternData.palette.some(color => 
                    color[0] === rgbColor[0] && color[1] === rgbColor[1] && color[2] === rgbColor[2]);
                
                if (colorExists) {
                    alert('This color is already in the palette!');
                    return;
                }
                
                // Add new color to palette
                this.currentPatternData.palette.push(rgbColor);
                
                // Refresh the edit color palette
                this.setupEditColorPalette();
                
                // Also update the main color palette display
                this.displayColorPalette(this.currentPatternData.palette);
                
                // Auto-select the new color
                this.selectedEditColor = [...rgbColor];
                
                console.log('New color added successfully');
            });
        }
    }

    openColorEditor(colorIndex, currentColor) {
        if (!this.currentPatternData) return;
        
        // Create color editor modal
        const modal = document.createElement('div');
        modal.className = 'color-picker-modal';
        modal.innerHTML = `
            <div class="color-picker-content">
                <h4>Edit Color ${colorIndex + 1} Throughout Pattern</h4>
                <p>This will change all stitches currently using this color</p>
                <div class="color-picker-section">
                    <label for="colorEditor">Choose new color:</label>
                    <input type="color" id="colorEditor" value="${this.rgbToHex(currentColor)}">
                </div>
                <div class="color-preview">
                    <div class="current-color">
                        <span>Current:</span>
                        <div class="color-sample" style="background-color: rgb(${currentColor.join(', ')})"></div>
                    </div>
                    <div class="new-color">
                        <span>New:</span>
                        <div class="color-sample" id="newColorSample" style="background-color: ${this.rgbToHex(currentColor)}"></div>
                    </div>
                </div>
                <div class="color-picker-buttons">
                    <button id="applyColorEdit" class="apply-btn">Apply to All</button>
                    <button id="cancelColorEdit" class="cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const colorEditor = modal.querySelector('#colorEditor');
        const newColorSample = modal.querySelector('#newColorSample');
        const applyBtn = modal.querySelector('#applyColorEdit');
        const cancelBtn = modal.querySelector('#cancelColorEdit');
        
        // Update preview as user changes color
        colorEditor.addEventListener('input', (e) => {
            newColorSample.style.backgroundColor = e.target.value;
        });
        
        // Apply color change to all instances
        applyBtn.addEventListener('click', () => {
            const newColor = this.hexToRgb(colorEditor.value);
            this.updateAllInstancesOfColor(colorIndex, currentColor, newColor);
            document.body.removeChild(modal);
        });
        
        // Cancel color change
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    updateAllInstancesOfColor(colorIndex, oldColor, newColor) {
        if (!this.currentPatternData) return;
        
        console.log('Updating all instances of color', colorIndex, 'from', oldColor, 'to', newColor);
        
        // Update the palette
        this.currentPatternData.palette[colorIndex] = [...newColor];
        
        // Update all pixels that use this color
        this.currentPatternData.pixels = this.currentPatternData.pixels.map(pixel => {
            if (pixel[0] === oldColor[0] && pixel[1] === oldColor[1] && pixel[2] === oldColor[2]) {
                return [...newColor];
            }
            return pixel;
        });
        
        // Update the selected edit color if it was the one being changed
        if (this.selectedEditColor && 
            this.selectedEditColor[0] === oldColor[0] && 
            this.selectedEditColor[1] === oldColor[1] && 
            this.selectedEditColor[2] === oldColor[2]) {
            this.selectedEditColor = [...newColor];
        }
        
        // Redraw pattern and palettes
        this.displayPattern(this.currentPatternData, this.currentPatternData.width, this.currentPatternData.height);
        this.displayColorPalette(this.currentPatternData.palette);
        this.setupEditColorPalette();
        
        console.log('Color update completed');
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
        const defaultWidthInches = 7.1; // Default width at 7.1 inches
        const aspectRatio = img.height / img.width;
        const calculatedHeightInches = defaultWidthInches * aspectRatio;
        
        // Set the measurement input values
        document.getElementById('widthInches').value = defaultWidthInches.toFixed(1);
        document.getElementById('widthCm').value = (defaultWidthInches * 2.54).toFixed(1);
        document.getElementById('heightInches').value = calculatedHeightInches.toFixed(1);
        document.getElementById('heightCm').value = (calculatedHeightInches * 2.54).toFixed(1);
        
        // Update hidden stitch inputs to match measurements
        this.updateStitchesFromMeasurements();
    }

    updateHeightFromWidth() {
        if (!this.originalImage) return;
        
        const widthInches = parseFloat(document.getElementById('widthInches').value);
        const aspectRatio = this.originalImage.height / this.originalImage.width;
        
        if (!isNaN(widthInches)) {
            const calculatedHeightInches = (widthInches * aspectRatio);
            const calculatedHeightCm = (calculatedHeightInches * 2.54);
            
            // Update height measurements
            document.getElementById('heightInches').value = calculatedHeightInches.toFixed(1);
            document.getElementById('heightCm').value = calculatedHeightCm.toFixed(1);
            
            // Update hidden stitch inputs
            this.updateStitchesFromMeasurements();
        }
    }

    generatePattern() {
        if (!this.originalImage) return;

        const stitchWidth = parseInt(document.getElementById('stitchWidth').value);
        const stitchHeight = parseInt(document.getElementById('stitchHeight').value);
        const colorCount = parseInt(document.getElementById('colorCount').value);
        const enableSmoothing = document.getElementById('patternSmoothing').checked;

        // Create pattern
        const patternData = this.createPattern(stitchWidth, stitchHeight, colorCount, enableSmoothing);
        
        // Ensure width and height are set on the pattern data
        patternData.width = stitchWidth;
        patternData.height = stitchHeight;
        
        this.currentPatternData = patternData; // Store for export
        console.log('Generated pattern data:', patternData); // Debug log
        
        this.displayPattern(patternData, stitchWidth, stitchHeight);
        this.displayColorPalette(patternData.palette);
        
        // Show edit mode controls
        const editModeToggle = document.getElementById('editModeToggle');
        if (editModeToggle) {
            editModeToggle.style.display = 'inline-block';
        }
        
        // Calculate and display material estimates (always enabled)
        this.calculateAndDisplayMaterials(patternData, stitchWidth, stitchHeight);
        
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }
    }

    calculateAndDisplayMaterials(patternData, width, height) {
        const craftType = document.getElementById('craftType').value;
        
        let stitchesPerInch;
        if (['knitting', 'crochet'].includes(craftType)) {
            stitchesPerInch = parseFloat(document.getElementById('yarnGauge').value);
        } else {
            stitchesPerInch = parseInt(document.getElementById('fabricCount').value);
        }
        
        // Calculate finished dimensions
        const finishedWidth = width / stitchesPerInch;
        const finishedHeight = height / stitchesPerInch;
        
        // Count stitches per color
        const colorCounts = new Map();
        patternData.pixels.forEach(pixel => {
            const colorKey = `${pixel[0]},${pixel[1]},${pixel[2]}`;
            colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
        });
        
        // Calculate material requirements
        const materials = [];
        patternData.palette.forEach((color, index) => {
            const colorKey = `${color[0]},${color[1]},${color[2]}`;
            const stitchCount = colorCounts.get(colorKey) || 0;
            const yardage = this.calculateYardage(stitchCount, craftType, stitchesPerInch);
            
            materials.push({
                color: color,
                colorNumber: index + 1,
                stitchCount: stitchCount,
                yardage: yardage
            });
        });
        
        this.displayMaterialEstimates(materials, finishedWidth, finishedHeight, width * height);
    }

    calculateYardage(stitchCount, craftType, stitchesPerInch) {
        // Base calculations for different craft types
        let yardsPerStitch;
        
        switch (craftType) {
            case 'cross-stitch':
                // Cross-stitch uses about 1 inch of floss per stitch, multiply by strand count
                const crossStitchStrands = parseInt(document.getElementById('strandCount')?.value || 2);
                yardsPerStitch = (crossStitchStrands / stitchesPerInch) / 36; // Convert to yards
                break;
            case 'embroidery':
                // Embroidery varies, but similar to cross-stitch
                const embroideryStrands = parseInt(document.getElementById('strandCount')?.value || 2);
                yardsPerStitch = (embroideryStrands * 1.2 / stitchesPerInch) / 36;
                break;
            case 'knitting':
                // Knitting yardage depends on stitch size and yarn weight
                const yarnWeight = document.getElementById('yarnWeight').value;
                const weightMultipliers = {
                    'lace': 0.5, 'fingering': 0.7, 'sport': 1.0, 
                    'dk': 1.3, 'worsted': 1.8, 'bulky': 2.5, 'super-bulky': 3.5
                };
                // For knitting, gauge directly affects yarn usage
                yardsPerStitch = (weightMultipliers[yarnWeight] || 1.3) / (stitchesPerInch * 10);
                break;
            case 'crochet':
                // Crochet uses more yarn than knitting
                const crochetYarnWeight = document.getElementById('yarnWeight').value;
                const crochetMultipliers = {
                    'lace': 0.7, 'fingering': 1.0, 'sport': 1.4, 
                    'dk': 1.8, 'worsted': 2.5, 'bulky': 3.5, 'super-bulky': 5.0
                };
                yardsPerStitch = (crochetMultipliers[crochetYarnWeight] || 1.8) / (stitchesPerInch * 8);
                break;
            case 'tapestry':
                // Tapestry/needlepoint
                const tapestryStrands = parseInt(document.getElementById('strandCount')?.value || 2);
                yardsPerStitch = (tapestryStrands * 1.5 / stitchesPerInch) / 36;
                break;
            default:
                yardsPerStitch = (1 / stitchesPerInch) / 36;
        }
        
        const totalYards = stitchCount * yardsPerStitch;
        
        // Add 10% waste factor
        return Math.ceil(totalYards * 1.1 * 100) / 100; // Round to 2 decimal places
    }

    displayMaterialEstimates(materials, finishedWidth, finishedHeight, totalStitches) {
        const materialEstimates = document.getElementById('materialEstimates');
        const finishedSizeSpan = document.getElementById('finishedSize');
        const totalStitchesSpan = document.getElementById('totalStitches');
        const materialList = document.getElementById('materialList');
        
        if (!materialEstimates || !finishedSizeSpan || !totalStitchesSpan || !materialList) return;
        
        // Update project info
        finishedSizeSpan.textContent = `${finishedWidth.toFixed(1)}" × ${finishedHeight.toFixed(1)}"`;
        totalStitchesSpan.textContent = totalStitches.toLocaleString();
        
        // Clear and populate material list
        materialList.innerHTML = '';
        
        materials.forEach(material => {
            if (material.stitchCount > 0) {
                const materialItem = document.createElement('div');
                materialItem.className = 'material-item';
                materialItem.style.borderLeftColor = `rgb(${material.color.join(', ')})`;
                
                materialItem.innerHTML = `
                    <div class="material-color">
                        <div class="material-swatch" style="background-color: rgb(${material.color.join(', ')})"></div>
                        <div class="material-details">
                            <div class="material-name">Color ${material.colorNumber}</div>
                            <div class="material-rgb">RGB(${material.color.join(', ')})</div>
                        </div>
                    </div>
                    <div class="material-amount">
                        <div class="material-yardage">${material.yardage} yards</div>
                        <div class="material-stitches">${material.stitchCount.toLocaleString()} stitches</div>
                    </div>
                `;
                
                materialList.appendChild(materialItem);
            }
        });
        
        // Show the material estimates section
        materialEstimates.style.display = 'block';
    }

    createPattern(width, height, colorCount, enableSmoothing = true) {
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
        let quantizedPixels = this.quantizePixels(pixels, palette);
        
        // Apply smoothing if enabled
        if (enableSmoothing) {
            quantizedPixels = this.smoothPattern(quantizedPixels, width, height, palette);
        }
        
        return {
            pixels: quantizedPixels,
            palette: palette,
            width: width,
            height: height
        };
    }

    smoothPattern(pixels, width, height, palette) {
        // Create a 2D array for easier neighbor checking
        const grid = [];
        for (let y = 0; y < height; y++) {
            grid[y] = [];
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                grid[y][x] = pixels[index];
            }
        }
        
        // Apply smoothing algorithm
        const smoothedGrid = JSON.parse(JSON.stringify(grid)); // Deep copy
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const currentColor = grid[y][x];
                const neighbors = [
                    grid[y-1][x-1], grid[y-1][x], grid[y-1][x+1],
                    grid[y][x-1],                 grid[y][x+1],
                    grid[y+1][x-1], grid[y+1][x], grid[y+1][x+1]
                ];
                
                // Check if current pixel is isolated (different from all neighbors)
                const isIsolated = neighbors.every(neighbor => 
                    !this.colorsEqual(currentColor, neighbor)
                );
                
                if (isIsolated) {
                    // Find the most common neighbor color
                    const colorCounts = new Map();
                    neighbors.forEach(neighbor => {
                        const colorKey = `${neighbor[0]},${neighbor[1]},${neighbor[2]}`;
                        colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
                    });
                    
                    let mostCommonColor = currentColor;
                    let maxCount = 0;
                    
                    for (const [colorKey, count] of colorCounts) {
                        if (count > maxCount) {
                            maxCount = count;
                            const [r, g, b] = colorKey.split(',').map(Number);
                            mostCommonColor = [r, g, b];
                        }
                    }
                    
                    smoothedGrid[y][x] = mostCommonColor;
                }
            }
        }
        
        // Convert back to flat array
        const smoothedPixels = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                smoothedPixels.push(smoothedGrid[y][x]);
            }
        }
        
        return smoothedPixels;
    }
    
    colorsEqual(color1, color2) {
        return color1[0] === color2[0] && 
               color1[1] === color2[1] && 
               color1[2] === color2[2];
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
        if (!canvas) {
            console.error('Canvas not found!');
            return;
        }
        
        console.log('Displaying pattern with data:', { 
            pixels: patternData.pixels.length, 
            width, 
            height, 
            hasCanvas: !!canvas 
        });
        
        const ctx = canvas.getContext('2d');
        
        // Use a larger minimum cell size to make clicking easier
        const cellSize = Math.max(8, Math.min(400 / width, 400 / height));
        canvas.width = width * cellSize;
        canvas.height = height * cellSize;
        
        // Store cellSize for click detection
        this.cellSize = cellSize;
        console.log('Cell size set to:', this.cellSize);
        
        // Remove any existing click listener to avoid duplicates
        if (this.boundCanvasClick) {
            canvas.removeEventListener('click', this.boundCanvasClick);
        }
        
        // Create and bind the click handler
        this.boundCanvasClick = this.handleCanvasClick.bind(this);
        canvas.addEventListener('click', this.boundCanvasClick);
        console.log('Click listener bound to canvas');
        
        // Add a test click listener to see if ANY clicks are detected
        canvas.addEventListener('click', () => {
            console.log('TEST: Canvas was clicked!');
        });
        
        // Set cursor style based on edit mode
        this.updateCanvasStyle(canvas);
        
        console.log('Pattern display setup completed'); // Debug log
        
        // Draw pattern cells first
        patternData.pixels.forEach((color, index) => {
            const x = (index % width) * cellSize;
            const y = Math.floor(index / width) * cellSize;
            
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fillRect(x, y, cellSize, cellSize);
        });
        
        // Draw clean grid lines over the pattern
        this.drawGrid(ctx, width, height, cellSize);
        
        console.log('Pattern drawing completed');
    }

    updateCanvasStyle(canvas) {
        if (!canvas) canvas = document.getElementById('patternCanvas');
        if (!canvas) {
            console.log('Canvas not found in updateCanvasStyle');
            return;
        }

        console.log('Updating canvas style. Edit mode:', this.isEditMode);

        if (this.isEditMode) {
            canvas.style.cursor = 'crosshair';
            canvas.title = 'Select a color below, then click stitches to paint them';
            canvas.classList.add('edit-mode');
            console.log('Canvas set to edit mode');
        } else {
            canvas.style.cursor = 'default';
            canvas.title = 'Enable edit mode to modify stitches';
            canvas.classList.remove('edit-mode');
            console.log('Canvas set to view mode');
        }
        canvas.style.boxShadow = 'none';
        canvas.style.borderRadius = '0';
    }

    drawGrid(ctx, width, height, cellSize) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        
        // Draw vertical lines between pixels
        for (let x = 1; x < width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize - 0.5, 0);
            ctx.lineTo(x * cellSize - 0.5, height * cellSize);
            ctx.stroke();
        }
        
        // Draw horizontal lines between pixels
        for (let y = 1; y < height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize - 0.5);
            ctx.lineTo(width * cellSize, y * cellSize - 0.5);
            ctx.stroke();
        }
    }

    handleCanvasClick(event) {
        console.log('=== HANDLE CANVAS CLICK CALLED ===');
        console.log('Edit mode:', this.isEditMode);
        console.log('Event:', event);
        
        // Only handle clicks if in edit mode
        if (!this.isEditMode) {
            console.log('Not in edit mode, ignoring click');
            return;
        }

        console.log('Canvas clicked in edit mode!', event);
        if (!this.currentPatternData || !this.cellSize) {
            console.log('Missing data:', { 
                hasPatternData: !!this.currentPatternData, 
                hasCellSize: !!this.cellSize,
                patternData: this.currentPatternData 
            });
            return;
        }
        
        const canvas = event.target;
        const rect = canvas.getBoundingClientRect();
        
        // Get more accurate coordinates accounting for canvas scaling
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        
        console.log('Raw click:', { 
            clientX: event.clientX, 
            clientY: event.clientY, 
            rectLeft: rect.left, 
            rectTop: rect.top,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            rectWidth: rect.width,
            rectHeight: rect.height,
            scaleX,
            scaleY
        });
        console.log('Adjusted click position:', { x, y, cellSize: this.cellSize });
        
        // Calculate which stitch was clicked
        const stitchX = Math.floor(x / this.cellSize);
        const stitchY = Math.floor(y / this.cellSize);
        
        console.log('Stitch coordinates:', { stitchX, stitchY });
        console.log('Pattern dimensions:', { width: this.currentPatternData.width, height: this.currentPatternData.height });
        
        // Check bounds
        if (stitchX >= 0 && stitchX < this.currentPatternData.width && 
            stitchY >= 0 && stitchY < this.currentPatternData.height) {
            
            const stitchIndex = stitchY * this.currentPatternData.width + stitchX;
            console.log('Painting stitch at index:', stitchIndex, 'with color:', this.selectedEditColor);
            
            if (this.selectedEditColor) {
                this.updateSingleStitch(stitchIndex, this.selectedEditColor);
            } else {
                console.log('No color selected for painting');
            }
        } else {
            console.log('Click outside bounds');
        }
    }

    cycleStitchColor(stitchIndex) {
        if (!this.currentPatternData || !this.currentPatternData.palette) {
            return;
        }

        const currentColor = this.currentPatternData.pixels[stitchIndex];
        const palette = this.currentPatternData.palette;
        
        // Find current color index in palette
        let currentColorIndex = -1;
        for (let i = 0; i < palette.length; i++) {
            const paletteColor = palette[i];
            if (currentColor[0] === paletteColor[0] && 
                currentColor[1] === paletteColor[1] && 
                currentColor[2] === paletteColor[2]) {
                currentColorIndex = i;
                break;
            }
        }
        
        // Get next color in palette (cycle back to 0 if at end)
        const nextColorIndex = (currentColorIndex + 1) % palette.length;
        const nextColor = palette[nextColorIndex];
        
        console.log(`Cycling from color ${currentColorIndex} to ${nextColorIndex}`);
        
        // Update the stitch
        this.updateSingleStitch(stitchIndex, nextColor);
    }

    openStitchColorPicker(stitchIndex, stitchX, stitchY) {
        if (!this.currentPatternData) return;
        
        const currentColor = this.currentPatternData.pixels[stitchIndex];
        
        // Create stitch color picker modal
        const modal = document.createElement('div');
        modal.className = 'stitch-color-picker-modal';
        modal.innerHTML = `
            <div class="stitch-color-picker-content">
                <h4>Edit Stitch at Row ${stitchY + 1}, Column ${stitchX + 1}</h4>
                
                <div class="stitch-color-options">
                    <div class="palette-selection">
                        <h5>Choose from Pattern Colors:</h5>
                        <div class="palette-grid" id="stitchPaletteGrid"></div>
                    </div>
                </div>
                
                <div class="stitch-color-preview">
                    <div class="current-stitch">
                        <span>Current:</span>
                        <div class="stitch-sample" style="background-color: rgb(${currentColor.join(', ')})"></div>
                    </div>
                    <div class="new-stitch" id="newStitchPreview">
                        <span>New:</span>
                        <div class="stitch-sample" style="background-color: rgb(${currentColor.join(', ')})"></div>
                    </div>
                </div>
                
                <div class="stitch-color-buttons">
                    <button id="applyStitchColor" class="apply-btn">Apply</button>
                    <button id="cancelStitchColor" class="cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Populate palette grid
        const paletteGrid = modal.querySelector('#stitchPaletteGrid');
        this.currentPatternData.palette.forEach((color, index) => {
            const colorOption = document.createElement('div');
            colorOption.className = 'palette-color-option';
            colorOption.style.backgroundColor = `rgb(${color.join(', ')})`;
            colorOption.title = `Color ${index + 1} - RGB(${color.join(', ')})`;
            
            // Highlight current color
            if (currentColor[0] === color[0] && currentColor[1] === color[1] && currentColor[2] === color[2]) {
                colorOption.classList.add('selected');
            }
            
            colorOption.addEventListener('click', () => {
                // Remove previous selection
                paletteGrid.querySelectorAll('.palette-color-option').forEach(opt => 
                    opt.classList.remove('selected'));
                colorOption.classList.add('selected');
                
                // Update preview
                this.updateStitchPreview(color, modal);
                this.selectedStitchColor = color;
            });
            
            paletteGrid.appendChild(colorOption);
        });
        
        // Set initial selection
        this.selectedStitchColor = currentColor;
        
        // Button handling
        const applyBtn = modal.querySelector('#applyStitchColor');
        const cancelBtn = modal.querySelector('#cancelStitchColor');
        
        applyBtn.addEventListener('click', () => {
            if (this.selectedStitchColor) {
                this.updateSingleStitch(stitchIndex, this.selectedStitchColor);
            }
            document.body.removeChild(modal);
        });
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    updateStitchPreview(color, modal) {
        const newStitchPreview = modal.querySelector('#newStitchPreview .stitch-sample');
        if (newStitchPreview) {
            newStitchPreview.style.backgroundColor = `rgb(${color.join(', ')})`;
        }
    }

    updateSingleStitch(stitchIndex, newColor) {
        if (!this.currentPatternData) return;
        
        // Update the pixel at the specific index
        this.currentPatternData.pixels[stitchIndex] = [...newColor];
        
        // Redraw only the affected stitch for performance
        const canvas = document.getElementById('patternCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = this.currentPatternData.width;
        const height = this.currentPatternData.height;
        
        const x = (stitchIndex % width) * this.cellSize;
        const y = Math.floor(stitchIndex / width) * this.cellSize;
        
        // Redraw this stitch
        ctx.fillStyle = `rgb(${newColor[0]}, ${newColor[1]}, ${newColor[2]})`;
        ctx.fillRect(x, y, this.cellSize, this.cellSize);
        
        // Redraw the grid lines that intersect this cell
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        
        ctx.beginPath();
        // Only redraw interior grid lines (not outer borders)
        if (x > 0) {
            // Left line
            ctx.moveTo(x - 0.5, y);
            ctx.lineTo(x - 0.5, y + this.cellSize);
        }
        if (y > 0) {
            // Top line
            ctx.moveTo(x, y - 0.5);
            ctx.lineTo(x + this.cellSize, y - 0.5);
        }
        if (x + this.cellSize < width * this.cellSize) {
            // Right line
            ctx.moveTo(x + this.cellSize - 0.5, y);
            ctx.lineTo(x + this.cellSize - 0.5, y + this.cellSize);
        }
        if (y + this.cellSize < height * this.cellSize) {
            // Bottom line
            ctx.moveTo(x, y + this.cellSize - 0.5);
            ctx.lineTo(x + this.cellSize, y + this.cellSize - 0.5);
        }
        ctx.stroke();
    }

    displayColorPalette(palette) {
        const container = document.getElementById('paletteColors');
        if (!container) return;
        
        container.innerHTML = '';
        
        palette.forEach((color, index) => {
            const swatchContainer = document.createElement('div');
            swatchContainer.className = 'color-swatch-container';
            
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            swatch.textContent = index + 1;
            swatch.title = `Color ${index + 1} - RGB(${color.join(', ')}) - Use edit mode to modify`;
            
            // Remove the click event for editing - editing is now only in edit mode
            
            const colorInfo = document.createElement('div');
            colorInfo.className = 'color-info';
            colorInfo.textContent = `RGB(${color[0]}, ${color[1]}, ${color[2]})`;
            
            swatchContainer.appendChild(swatch);
            swatchContainer.appendChild(colorInfo);
            container.appendChild(swatchContainer);
        });
    }

    openColorPicker(colorIndex) {
        if (!this.currentPatternData) return;
        
        // Create color picker modal
        const modal = document.createElement('div');
        modal.className = 'color-picker-modal';
        modal.innerHTML = `
            <div class="color-picker-content">
                <h4>Change Color ${colorIndex + 1}</h4>
                <div class="color-picker-section">
                    <label for="colorPicker">Choose new color:</label>
                    <input type="color" id="colorPicker" value="${this.rgbToHex(this.currentPatternData.palette[colorIndex])}">
                </div>
                <div class="color-preview">
                    <div class="current-color">
                        <span>Current:</span>
                        <div class="color-sample" style="background-color: rgb(${this.currentPatternData.palette[colorIndex].join(', ')})"></div>
                    </div>
                    <div class="new-color">
                        <span>New:</span>
                        <div class="color-sample" id="newColorSample" style="background-color: ${this.rgbToHex(this.currentPatternData.palette[colorIndex])}"></div>
                    </div>
                </div>
                <div class="color-picker-buttons">
                    <button id="applyColor" class="apply-btn">Apply</button>
                    <button id="cancelColor" class="cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const colorPicker = modal.querySelector('#colorPicker');
        const newColorSample = modal.querySelector('#newColorSample');
        const applyBtn = modal.querySelector('#applyColor');
        const cancelBtn = modal.querySelector('#cancelColor');
        
        // Update preview as user changes color
        colorPicker.addEventListener('input', (e) => {
            newColorSample.style.backgroundColor = e.target.value;
        });
        
        // Apply color change
        applyBtn.addEventListener('click', () => {
            const newColor = this.hexToRgb(colorPicker.value);
            this.updatePatternColor(colorIndex, newColor);
            document.body.removeChild(modal);
        });
        
        // Cancel color change
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    updatePatternColor(colorIndex, newColor) {
        if (!this.currentPatternData) return;
        
        const oldColor = this.currentPatternData.palette[colorIndex];
        
        // Update palette
        this.currentPatternData.palette[colorIndex] = newColor;
        
        // Update all pixels that use this color
        this.currentPatternData.pixels = this.currentPatternData.pixels.map(pixel => {
            if (pixel[0] === oldColor[0] && pixel[1] === oldColor[1] && pixel[2] === oldColor[2]) {
                return [...newColor];
            }
            return pixel;
        });
        
        // Redraw pattern and palette
        this.displayPattern(this.currentPatternData, this.currentPatternData.width, this.currentPatternData.height);
        this.displayColorPalette(this.currentPatternData.palette);
    }

    rgbToHex(rgb) {
        const r = rgb[0].toString(16).padStart(2, '0');
        const g = rgb[1].toString(16).padStart(2, '0');
        const b = rgb[2].toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
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
        const craftType = document.getElementById('craftType').value;
        
        let stitchesPerInch;
        let sizeLabel;
        if (['knitting', 'crochet'].includes(craftType)) {
            stitchesPerInch = parseFloat(document.getElementById('yarnGauge').value);
            sizeLabel = `${stitchesPerInch} sts/inch gauge`;
        } else {
            stitchesPerInch = parseInt(document.getElementById('fabricCount').value);
            sizeLabel = `${stitchesPerInch}-count fabric`;
        }
        
        // Calculate material requirements for export
        const colorCounts = new Map();
        this.currentPatternData.pixels.forEach(pixel => {
            const colorKey = `${pixel[0]},${pixel[1]},${pixel[2]}`;
            colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
        });
        
        const craftNames = {
            'knitting': 'KNITTING',
            'cross-stitch': 'CROSS-STITCH',
            'embroidery': 'EMBROIDERY',
            'crochet': 'CROCHET',
            'tapestry': 'TAPESTRY/NEEDLEPOINT'
        };
        
        let guideText = `COLOR GUIDE FOR ${craftNames[craftType]} PATTERN\n`;
        guideText += `Generated: ${new Date().toLocaleDateString()}\n\n`;
        
        // Calculate finished size
        const finishedWidth = this.currentPatternData.width / stitchesPerInch;
        const finishedHeight = this.currentPatternData.height / stitchesPerInch;
        
        guideText += `PROJECT SPECIFICATIONS:\n`;
        guideText += `• Pattern size: ${this.currentPatternData.width} x ${this.currentPatternData.height} stitches\n`;
        guideText += `• Finished size: ${finishedWidth.toFixed(1)}" x ${finishedHeight.toFixed(1)}"\n`;
        guideText += `• ${sizeLabel}\n`;
        
        // Add strand information for floss-based crafts
        if (['cross-stitch', 'embroidery', 'tapestry'].includes(craftType)) {
            const strandCount = document.getElementById('strandCount')?.value || 2;
            guideText += `• Strands of floss: ${strandCount}\n`;
        }
        
        guideText += `• Total colors: ${palette.length}\n\n`;
        
        guideText += `MATERIAL REQUIREMENTS:\n`;
        guideText += `(Use these RGB values to match with your preferred yarn/thread brand)\n\n`;
        
        palette.forEach((color, index) => {
            const colorKey = `${color[0]},${color[1]},${color[2]}`;
            const stitchCount = colorCounts.get(colorKey) || 0;
            const yardage = this.calculateYardage(stitchCount, craftType, stitchesPerInch);
            
            guideText += `Color ${index + 1}:\n`;
            guideText += `  RGB: ${color[0]}, ${color[1]}, ${color[2]}\n`;
            guideText += `  Hex: #${color[0].toString(16).padStart(2, '0')}${color[1].toString(16).padStart(2, '0')}${color[2].toString(16).padStart(2, '0')}\n`;
            guideText += `  Stitches: ${stitchCount.toLocaleString()}\n`;
            guideText += `  Estimated yardage: ${yardage} yards\n`;
            guideText += `  Brand: ________________\n`;
            guideText += `  Color name: ________________\n`;
            guideText += `  Amount purchased: ________________\n\n`;
        });

        guideText += `PATTERN NOTES:\n`;
        if (craftType === 'knitting') {
            guideText += `• Work from bottom up, reading chart right to left on RS rows\n`;
            guideText += `• Read chart left to right on WS rows\n`;
            guideText += `• Consider yarn weight and needle size for gauge\n`;
        } else if (craftType === 'cross-stitch') {
            guideText += `• Work from top down, left to right\n`;
            guideText += `• Use ${stitchesPerInch}-count fabric as specified\n`;
            guideText += `• Recommended: 2 strands of floss for coverage\n`;
        } else if (craftType === 'embroidery') {
            guideText += `• Work direction varies by technique\n`;
            guideText += `• Adjust thread strands for desired coverage\n`;
            guideText += `• Consider fabric type and weight\n`;
        } else if (craftType === 'crochet') {
            guideText += `• Work as single crochet or desired stitch\n`;
            guideText += `• Consider yarn weight and hook size for gauge\n`;
            guideText += `• May require more yarn than knitting\n`;
        }
        
        guideText += `• Estimates include 10% waste factor\n`;
        guideText += `• Always purchase extra for color matching\n`;

        this.downloadText(guideText, `${craftType}-color-guide.txt`);
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
