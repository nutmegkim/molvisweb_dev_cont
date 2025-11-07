import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { PDBLoader } from './mymods/PDBLoader.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import CameraControls from 'https://cdn.jsdelivr.net/npm/camera-controls/dist/camera-controls.module.js';
CameraControls.install( { THREE: THREE } );


// GLOBAL CONSTANTS
const CPK = 'Ball-and-stick';
const VDW = 'Space filling';
const lines = 'Lines';
const reps = [CPK, VDW, lines];

let bondMetadata = [];
let metadataMap = new Map();
globalThis.metadataMap = metadataMap;

let CPKbonds = 0;
let linesBonds = 0;

const MOLECULES = {
    'Ponatinib': 'ponatinib_Sep2022.pdb',
    'Caffeine': 'caffeine.pdb',
    'Abl kinase': 'Ablkinase.pdb',
    'Ponatinib abl kinase': 'ponatinib_Ablkinase_Jun2022.pdb'
};

const residue = 'residue';
const molecule = 'molecule';
const distance = 'distance';

const hidden = 'hidden';
const shown = 'shown';

const name = 'Name';
const blue = 'Blue';
const red = 'Red';
const green = 'Green';

// icosahedron 
const detail = 2;
const textSize = 5;

const sphereScaleCPK = 0.25;
const sphereScaleVDW = 0.8;

const zeroScale = new THREE.Vector3(0, 0, 0);
const identityScale = new THREE.Vector3(1, 1, 1);  

// tab IDs
const usedTabIDs = new Set();
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const shapes = [ "★", "☆", "♥", "●", "◆", "▲", "■", "□", "△", "○", "✿", "▰", 
    "▱", "▮", "▯" ];

const repsData = [];

let repDataDefault = {
    id: null,
    drawingMethod: CPK,
    selectionMethod: residue,
    selectionValue: 'all',
    coloringMethod: name,
    state: shown
}

// initialize the baseline objects  
let camera, scene, renderer, container;
let controls;
let root = new THREE.Group();
let geometryAtoms, geometryBonds, json_atoms, json_bonds, json_bonds_manual, json_bonds_conect, residues, chains;
let raycaster, mouse = {x: 0, y: 0 }

let atomInstancedMeshCPK, atomInstancedMeshVDW, bondInstancedMeshLines, bondInstancedMeshCPK;
let instancedMeshArray = [];

const cameraOption = 'orthographic';
const drawRay = false;

let initialPosition, initialQuaternion;
let initialTarget = new THREE.Vector3(0,0,0);

const PDBloader = new PDBLoader(); 
const offset = new THREE.Vector3();

// setting default/on load molecule  

const defaultParams = {
    mculeParams: { molecule: 'caffeine.pdb' },
    repParams: { representation: CPK },
    colorParams: { color: name },
    residueParams: { residue: 'all' },
    chainParams: { chain: 'all' },
    atomParams: { atom: 'all' },
    withinParams: { within: 0 },
    withinDropdownParams: { withinDropdown: 'molecule' },
    withinResParams: { withinRes: "" }
}

let selectedObject = null;

let distanceMeasurementAtoms = [];
let distanceLines = [];
const atomContent = document.getElementsByClassName('atom-content')[0];
const bondLengthContent = document.getElementsByClassName('bond-length-content')[0];
const errorContent = document.getElementsByClassName('error-content')[0];

const hideShowButton = document.getElementById('hide-show-rep');

var currentMolecule = 'caffeine.pdb';
var currentStyle = defaultParams.repParams.representation;
var currentSelectionMethod = 'residue';
var currentSelectionValue = defaultParams.residueParams.residue;

var numRepTabs = 1;
var currentRep = null;

globalThis.numRepTabs = numRepTabs;
globalThis.currentRep = currentRep;

const maxRepTabs = 10;

let guis = {};
let tabs = {};
let guiContainers = [];

let frames = 0, prevTime = performance.now();
const framesOn = false;

const backboneAtoms = ['c', 'ca', 'n', 'o'];

// set key controls
let isDistanceMeasurementMode = false;
let isCenterMode = false;

// amount of molecule selected, may change
var residueSelected = defaultParams.residueParams.residue; // default all
var chainSelected = defaultParams.chainParams.chain;
 
// specific settings for the raycaster (clicker) that make it senstitive enough to distinguish atoms 
raycaster = new THREE.Raycaster();
raycaster.near = .1;
raycaster.far = Infinity;
raycaster.params.Points.threshold = 0.1; 
raycaster.params.Line.threshold = 0.1;  

function setUpCamera() {

    if (cameraOption == 'orthographic') {

        let box = getVisibleBoundingBox();
        const size = new THREE.Vector3();
        box.getSize(size);
        let maxDim = Math.max(size.x, size.y, size.z);

        const center = new THREE.Vector3();
        box.getCenter(center);

        let aspectRatio = window.innerWidth / window.innerHeight;

        let paddingFactor = 1.1;
        let viewSize = Math.max(size.x, size.y, size.z) * paddingFactor;

        let left = -aspectRatio * viewSize / 2;
        let right = aspectRatio * viewSize / 2;
        let top = viewSize / 2;
        let bottom = -viewSize / 2;
        let near = 1;   
        let far = 10000;   

        // Create the orthographic camera
        camera.left = left;
        camera.right = right;
        camera.top = top;
        camera.bottom = bottom;
        camera.near = near;
        camera.far = far;

        camera.position.set(center.x, center.y, maxDim * 2);

        camera.updateProjectionMatrix();

    } else {
        camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 5000 );
        camera.position.z = 1000;

        globalThis.camera = camera;
        scene.add(camera);
    }        

    globalThis.camera = camera;
    scene.add(camera);

    initialPosition = camera.position.clone();
    initialQuaternion = camera.quaternion.clone();
}

function setUpLights() {
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    const light1 = new THREE.DirectionalLight(0xffffff, 2.5);
    light1.position.set(1, 1, 1);
    scene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffffff, 1.5);
    light2.position.set(1, -1, -1);
    scene.add(light2);
}

function setUpRenderer() {
    container = document.getElementsByClassName('column middle')[0]; 
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerWidth, containerHeight);
    renderer.domElement.id = 'canvas';
    container.appendChild(renderer.domElement);
}

function setUpControls() {

    if (cameraOption == 'orthographic') {
        const clock = new THREE.Clock();
        controls = new CameraControls( camera, renderer.domElement );

        ( function anim () {

            const delta = clock.getDelta();
            const hasControlsUpdated = controls.update( delta );
        
            requestAnimationFrame( anim );
            renderer.render( scene, camera );
        
        } )();

		controls.addEventListener( 'update', render ); // call this only in static scenes (i.e., if there is no animation loop)

        const box = getVisibleBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);

        controls.setLookAt(
            camera.position.x, camera.position.y, camera.position.z,  // camera position
            center.x, center.y, center.z   // look-at target
        );

        controls.minDistance = 1; 
        controls.maxDistance = 100;
        controls.update();

        camera.lookAt(controls.getTarget(new THREE.Vector3));
        
        const moveSpeed = 0.4;

        // Event listener for key presses
        document.addEventListener("keydown", (event) => {
            switch (event.code) {
                case "ArrowRight":
                controls.truck(-moveSpeed, 0, true);
                    break;
                case "ArrowLeft":
                    controls.truck(moveSpeed, 0, true);
                    break;
                case "ArrowDown":
                    controls.truck(0, -moveSpeed, true);
                    break;
                case "ArrowUp":
                    controls.truck(0, moveSpeed, true);
                    break;
            }
        });

    } else {
        controls = new TrackballControls( camera, renderer.domElement ); // TODO, controls zooming out boundaries
        controls.minDistance = 100;
        controls.maxDistance = 3000;
    }
}

init();

// init function - sets up scene, camera, renderer, controls, and GUIs 
function init() {

    // initialize main window 
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x000000 );
    globalThis.scene = scene;
    
    container = document.getElementsByClassName('column middle')[0]; 
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // addAxes();

    setUpLights();
    setUpRenderer();

    camera = new THREE.OrthographicCamera(0,0,0,0,0,0);

    // the default/first molecule to show up 

    loadMolecule(defaultParams.mculeParams.molecule, () => {
        setUpCamera();
        setUpControls();

        storeInitialView();
        
        onWindowResize();

        scene.add( root );
        root.visible = true;    

        resetViewCameraWindow();
    });
    

    // dynamic screen size 
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', raycast);
    window.addEventListener('keypress', keypressD);
    window.addEventListener('keypress', keypressC);
    window.addEventListener('keypress', keypressEqual);

    document.addEventListener('keydown', function(event) {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
            event.preventDefault(); 
        }
    }); 

    // add event listeners to buttons
    const addRep = document.getElementById('add-rep');
    addRep.addEventListener('click', onAddRepClick);

    const deleteRep = document.getElementById('delete-rep');
    deleteRep.addEventListener('click', onDeleteRepClick);

    const hideRep = document.getElementById('hide-show-rep');
    hideRep.addEventListener('click', onHideShowRepClick);

    const hideQuestions = document.getElementById('hide-questions');
    hideQuestions.addEventListener('click', onHideQuestions);

    const nextBack = document.getElementById('next-back');
    nextBack.addEventListener('click', onNextBack);

    // add molecule selection GUI to div with class=molecule-gui
    const molGUIContainer = document.getElementById('mol-gui');
    const moleculeGUI = new GUI({ autoPlace: false }); 
    const molMenu = moleculeGUI.add(defaultParams.mculeParams, 'molecule', MOLECULES);
    molGUIContainer.appendChild(molMenu.domElement); 

    molMenu.onChange(function(molecule) {
        console.log("trying to load", molecule, defaultParams.repParams.representation);
        residueSelected = 'all';

        currentMolecule = molecule;

        resetScene();

        loadMolecule(molecule, () => { resetViewCameraWindow(); });
        resetInterface();
    });

    // ----------------------------------------------------------
    // File upload event listener for reading .pdb files directly
    // ----------------------------------------------------------
    const pdbForm = document.getElementById('pdb-upload-form');
    if (pdbForm) {
        pdbForm.addEventListener('submit', function(e) {
            e.preventDefault(); 

            const fileInput = document.getElementById('pdbFile');
            const file = fileInput.files[0];
            if (!file) {
                alert("Please choose a PDB file first.");
                return;
            }

            const reader = new FileReader();

            reader.onload = function(event) {
                const pdbText = event.target.result;
                console.log("Loaded PDB file:", file.name);
                console.log(pdbText.substring(0, 300)); // preview text in console
                currentMolecule = pdbText;

                // Replace current molecule with uploaded one:
                resetScene(); // optional, clear current scene if you have a function for that
                loadMolecule(pdbText,() => { resetViewCameraWindow(); });
                resetInterface(); // optional, reinitialize controls if needed
            };

            reader.readAsText(file);
        });
    }


    createGUI();    
}

function resetEverything() {

    console.log('in resetEverything');

    resetScene();
    resetInterface();
    loadMolecule(currentMolecule);

    onWindowResize();
}

function resetInterface() {

    // remove tab buttons from DOM
    Object.values(tabs).forEach((tab) => { 
        tab.remove(); 
    });

    // remove gui DOM elements
    Object.keys(guis).forEach((key) => {
        let gui = guis[key];
        gui.domElement.remove();
        delete guis[key]; 
    });

    // create new initial tab and GUI
    repsData.length = 0;
    createGUI();
    numRepTabs = 1;
    showCurrentRep(currentRep);

    document.getElementsByClassName('atom-content')[0].innerHTML = '<p>selected atom: <br>none </p>';
    Array.from(document.getElementsByClassName('bond-length')).forEach( (elem) => elem.remove() );
    Array.from(document.getElementsByClassName('error-para')).forEach( (elem) => elem.remove() );

    distanceMeasurementAtoms = [];

    resetMouseModes();
}

function storeInitialView() {

    initialPosition.copy(camera.position);
    initialQuaternion.copy(camera.quaternion);
    
    controls.getTarget(initialTarget);
}

function resetScene() {
    while ( root.children.length > 0 ) {
        const object = root.children[ 0 ];
        object.parent.remove( object );
    }
}

/**
 * Helper function to get bounding box of objects visible on screen.
 * 
 * @param {boolean} visible - if true, draw red bounding box on screen for debugging
 * @returns {THREE.box3} bounding box
 */
function getVisibleBoundingBox(visible) {
    let box = new THREE.Box3();
    let instanceBox = new THREE.Box3();
    let tempMatrix = new THREE.Matrix4();

    for (const [_, obj] of metadataMap) {
        if (obj.visible) {
            let instanceID = obj.instanceID;
            let instancedMesh = obj.instancedMesh;
            
            instancedMesh.getMatrixAt(instanceID, tempMatrix);
            tempMatrix.premultiply(instancedMesh.matrixWorld); // must premultiply instance's matrix with instanceMesh world matrix to get absolute position in world space; instance's position is relative to instanceMesh's position

            // if bounding box for instancedMesh hasn't been computed yet, compute it
            if (!instancedMesh.geometry.boundingBox) {
                instancedMesh.geometry.computeBoundingBox();
            }

            // get local bounding box for instance
            instanceBox.copy(instancedMesh.geometry.boundingBox); 

            // apply absolute position of instance to local bounding box
            instanceBox.applyMatrix4(tempMatrix);

            // add instanceBox to overall box
            box.union(instanceBox);
        }
    }

    let helper = new THREE.Box3Helper(box, new THREE.Color(0xff0000)); 
    scene.add(helper);

    if (visible) {
        helper.visible = true;
    } else {
        helper.visible = false;
    }

    return box;
}

/**
 * Helper function to add x, y, and z axes to the rendering window
 */
function addAxes() {
    const axesHelper = new THREE.AxesHelper( 100 );
    scene.add( axesHelper );
}

function recenterCamera(camera, controls) {
    const boundingBox = getVisibleBoundingBox();
    fitCameraToBoundingBox(camera, controls, boundingBox);
    storeInitialView();
}

function calculateTime(startTime, endTime, message) {
    let totalTime = Math.abs(endTime - startTime);
    //console.log('time in milliseconds:', totalTime);
    console.log(message, 'in seconds:', totalTime/1000);
}

function getKey(mesh, instanceID) {
    return `${mesh.uuid}:${instanceID}`;
}

/**
 * Loads in PDB file.
 *
 * @param {string} model - PDB file name
 * @param {function} callback - anonymous function to be called after entire molecule is loaded in
 *                              useful for when recentering camera after molecule has loaded; if 
 *                              camera is recentered outside of callback function, molecule may not have
 *                              finished rendering fully so camera viewing window will be incorrect
 */
function loadMolecule(model, callback) { 
    popup();
    let startTime = new Date();

    //console.log("loading model", model, "representation", representation);

    currentMolecule = model;

    const url = './models/molecules/' + model;

    // empty metadata arrays and maps
    bondMetadata = [];
    metadataMap = new Map();

    PDBloader.load( url, function ( pdb ) {
        // properties of pdb loader that isolate the atoms & bonds
        let manual = true; // TO DO - use manual for now, implement options for manual OR conect later

        if (manual) { 
            geometryBonds = pdb.geometryBondsManual; 
        } else { 
            geometryBonds = pdb.geometryBondsConect;
        }

        //console.log("pdb.geometryBondsManual", pdb.geometryBondsManual.attributes.position.array);

        geometryAtoms = pdb.geometryAtoms;

        json_atoms = pdb.json_atoms;
        //console.log("json_atoms.atoms", json_atoms.atoms);
        json_bonds_manual = pdb.json_bonds_manual.bonds_manual;
        json_bonds_conect = pdb.json_bonds_conect.bonds_conect;

        json_bonds = json_bonds_manual;

        residues = pdb.residues;
        chains = pdb.chains;
        
        let randTime = new Date();

        //starting setup to put atoms into scene 
        geometryAtoms.computeBoundingBox();
        geometryAtoms.boundingBox.getCenter( offset ).negate(); // the offset moves the center of the bounding box to the origin?
        geometryAtoms.translate( offset.x, offset.y, offset.z );
        geometryBonds.translate( offset.x, offset.y, offset.z );

        let positions = geometryAtoms.getAttribute( 'position' );

        const colors = geometryAtoms.getAttribute( 'color' );
        //console.log('colors', colors);
        const position = new THREE.Vector3();

        let atomCount = positions.count * 2; // 2 because there are two drawing methods that use atoms
        let bondCount = geometryBonds.getAttribute('position').count;

        // pre-build geometries for atoms and bonds, InstancedMesh
        // CPK and VDW atom spheres will be scaled later based on element identity

        let sphereGeometry, boxGeometry;

        // CPK
        let sphereGeometryCPK = new THREE.IcosahedronGeometry(sphereScaleCPK, detail);
        let sphereMaterialCPK = new THREE.MeshPhongMaterial();
        atomInstancedMeshCPK = new THREE.InstancedMesh(sphereGeometryCPK, sphereMaterialCPK, atomCount);
        atomInstancedMeshCPK.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        atomInstancedMeshCPK.molecularElement = 'atom';
        atomInstancedMeshCPK.drawingMethod = CPK;
        let atomIndexCPK = 0;

        let boxGeometryCPK = new THREE.BoxGeometry( 0.08, 0.08, 0.6 );
        let bondMaterialCPK = new THREE.MeshPhongMaterial({ color: 0xffffff });
        bondInstancedMeshCPK = new THREE.InstancedMesh(boxGeometryCPK, bondMaterialCPK, bondCount);
        bondInstancedMeshCPK.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        bondInstancedMeshCPK.molecularElement = 'bond';
        bondInstancedMeshCPK.drawingMethod = CPK;
        let bondIndexCPK = 0;

        // VDW
        let sphereGeometryVDW = new THREE.IcosahedronGeometry(sphereScaleVDW, detail);
        let sphereMaterialVDW = new THREE.MeshPhongMaterial();
        atomInstancedMeshVDW = new THREE.InstancedMesh(sphereGeometryVDW, sphereMaterialVDW, atomCount);
        atomInstancedMeshVDW.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        atomInstancedMeshVDW.molecularElement = 'atom';
        atomInstancedMeshVDW.drawingMethod = VDW;
        let atomIndexVDW = 0;

        // Lines
        let boxGeometryLines = new THREE.BoxGeometry( 0.08, 0.08, 1 );
        let bondMaterialLines = new THREE.MeshPhongMaterial();
        bondInstancedMeshLines = new THREE.InstancedMesh(boxGeometryLines, bondMaterialLines, bondCount * 2);
        bondInstancedMeshLines.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        bondInstancedMeshLines.molecularElement = 'atom';
        bondInstancedMeshLines.drawingMethod = lines;
        let bondIndexLines = 0;
        
        root.visible = true;
        let randTimeEnd = new Date();
        //calculateTime(randTime, randTimeEnd, 'stuff before atom loading');

        let atomStartTime = new Date();

        // LOAD IN ATOMS 
        for ( let i = 0; i < positions.count; i ++ ) {
            //console.log(i);

            // loop through the positions array to get every atom 
            position.x = positions.getX( i );
            position.y = positions.getY( i );
            position.z = positions.getZ( i );

            //console.log("json_atoms.atoms", json_atoms.atoms)            
            
            // create a set of atoms/bonds in each of the 3 styles for each tab
            for (let key of reps) {
                
                let atomName = json_atoms.atoms[i][7];
                let atomElement = json_atoms.atoms[i][4];
                let residue = json_atoms.atoms[i][5];
                let resName = json_atoms.atoms[i][8];
                let chain = json_atoms.atoms[i][6];

                let color = new THREE.Color().setRGB(colors.getX( i ), colors.getY( i ), colors.getZ( i ));

                let material = new THREE.MeshPhongMaterial();
                material.color = color;

                if (key == VDW) {
                    const radius = getRadius(atomElement);
                    sphereGeometry = sphereGeometryVDW;

                    let dummy = new THREE.Object3D();
                    dummy.position.copy(position);
                    dummy.scale.set(radius, radius, radius);
                    dummy.updateMatrix();
                    atomInstancedMeshVDW.setMatrixAt(atomIndexVDW, dummy.matrix);
                    atomInstancedMeshVDW.setColorAt(atomIndexVDW, color);
                    //console.log("instanced ID", atomInstancedMeshCPK.instanceId);
                    
                    const transformedPosition = new THREE.Vector3();
                    dummy.matrix.decompose(transformedPosition, new THREE.Quaternion(), new THREE.Vector3());

                    let metadata = {
                        molecularElement: "atom",
                        drawingMethod: key,
                        repID: currentRep,
                        residue: residue,
                        chain: chain,
                        atomName: atomName,
                        atomElement: atomElement,
                        resName: resName,
                        printableString: resName + residue.toString() + ':' + atomName.toUpperCase(),
                        atomInfoSprite: null,
                        distanceLine: null,
                        colorUpdated: false,
                        originalColor: new THREE.Color().setRGB(colors.getX( i ), colors.getY( i ), colors.getZ( i )),
                        instanceID: atomIndexVDW,
                        instancedMesh: atomInstancedMeshVDW,
                        wireframe: null,
                        position: transformedPosition.clone(),
                        scale: new THREE.Vector3(radius, radius, radius),
                        quaternion: new THREE.Quaternion(),
                        visible: false
                    };

                    // push metadata into map for easy access
                    let atomKey = getKey(atomInstancedMeshVDW, atomIndexVDW);
                    metadataMap.set(atomKey, metadata);

                    atomIndexVDW++;
                    
                } else if (key == CPK) {
                    const radius = getRadius(atomElement);
                    sphereGeometry = sphereGeometryCPK;

                    let dummy = new THREE.Object3D();
                    dummy.position.copy(position);
                    dummy.scale.set(radius, radius, radius);
                    dummy.updateMatrix();
                    atomInstancedMeshCPK.setMatrixAt(atomIndexCPK, dummy.matrix);
                    atomInstancedMeshCPK.setColorAt(atomIndexCPK, color);

                    const transformedPosition = new THREE.Vector3();
                    dummy.matrix.decompose(transformedPosition, new THREE.Quaternion(), new THREE.Vector3());

                    let metadata = {
                        molecularElement: "atom",
                        drawingMethod: key,
                        repID: currentRep,
                        residue: residue,
                        chain: chain,
                        atomName: atomName,
                        atomElement: atomElement,
                        resName: resName,
                        printableString: resName + residue.toString() + ':' + atomName.toUpperCase(),
                        atomInfoSprite: null,
                        distanceLine: null,
                        colorUpdated: false,
                        originalColor: new THREE.Color().setRGB(colors.getX( i ), colors.getY( i ), colors.getZ( i )),
                        instanceID: atomIndexCPK,
                        instancedMesh: atomInstancedMeshCPK,
                        wireframe: null,
                        position: transformedPosition.clone(),
                        scale: new THREE.Vector3(radius, radius, radius),
                        quaternion: new THREE.Quaternion(),
                        visible: true
                    };

                    // push metadata into map for easy access
                    let atomKey = getKey(atomInstancedMeshCPK, atomIndexCPK);
                    metadataMap.set(atomKey, metadata);

                    atomIndexCPK++;
                }
                // skip atoms for lines drawing method
            } 
        }

        atomInstancedMeshCPK.count = atomIndexCPK;
        atomInstancedMeshCPK.instanceMatrix.needsUpdate = true;
        atomInstancedMeshCPK.instanceColor.needsUpdate = true;
        root.add(atomInstancedMeshCPK);

        atomInstancedMeshVDW.count = atomIndexVDW;
        atomInstancedMeshVDW.instanceMatrix.needsUpdate = true;
        atomInstancedMeshVDW.instanceColor.needsUpdate = true;
        root.add(atomInstancedMeshVDW);

        // hide VDW instances when first loading molecule
        atomInstancedMeshVDW.visible = false;

        let atomEndTime = new Date();
        calculateTime(atomStartTime, atomEndTime, 'time to load atoms');


        // LOAD IN BONDS
        let bondStartTime = new Date();
        positions = geometryBonds.getAttribute( 'position' );
        const start = new THREE.Vector3();
        const end = new THREE.Vector3();

        for ( let i = 0; i < positions.count; i += 2 ) {

            let bond = json_bonds[i/2]; // loops through bonds 0 to however many bonds there are, divide by 2 because i increments by 2 
            
            let atom1 = json_atoms.atoms[bond[0]-1];
            let atom2 = json_atoms.atoms[bond[1]-1];
            let color1 = atom1[3];
            let color2 = atom2[3];

            // convert color arrays into HTML strings that can be fed into a new THREE.color
            color1 = new THREE.Color(`rgb(${color1[0]}, ${color1[1]}, ${color1[2]})`);
            color2 = new THREE.Color(`rgb(${color2[0]}, ${color2[1]}, ${color2[2]})`);

            // get bond start & end locations 
            start.set(positions.getX(i), positions.getY(i), positions.getZ(i));
            end.set(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1));

            let bondVector = new THREE.Vector3().subVectors(end, start); // Direction from start to end
            let bondLength = bondVector.length(); // Get the bond length
            let mid = new THREE.Vector3().lerpVectors(start, end, 0.5); // Midpoint for positioning

            let quaternion = new THREE.Quaternion();
            let upVector = new THREE.Vector3(0, 0, 1); // Bonds are initially aligned along z-axis
            quaternion.setFromUnitVectors(upVector, bondVector.clone().normalize()); // Align bond to direction

            for (let key of reps) {

                if (key == CPK) { // TODO could potentially move this/combine with loading in atoms? some redundant information taken from atom1 and atom2 and put in metadata, since lines are technically atoms and not bonds

                    const instanceID = i/2;
                    let matrix = new THREE.Matrix4();
                    const scale = new THREE.Vector3(1, 1, bondLength); 
                    
                    matrix.compose(mid, quaternion, scale); 
                    bondInstancedMeshCPK.setMatrixAt(bondIndexCPK, matrix);
                    bondIndexCPK++;

                    let metadata = {
                            molecularElement: "bond",
                            drawingMethod: key,
                            atom1: atom1,
                            atom2: atom2,
                            originalColor: 'rgb(255, 255, 255)',
                            colorUpdated: false,
                            instanceID: instanceID,
                            instancedMesh: bondInstancedMeshCPK,
                            position: mid,
                            scale: scale.clone(),
                            quaternion: quaternion.clone(),
                            visible: true
                    };
                    
                    // push metadata into map 
                    let bondKey = getKey(bondInstancedMeshCPK, i, 0);
                    metadataMap.set(bondKey, metadata);
                    CPKbonds++;
                    
                } else if (key == lines) { // TODO could make CPK bonds use lines instancedMesh

                    const bondLength = start.distanceTo(end);
                    const halfBondLength = bondLength / 2;

                    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                    const bondDirection = new THREE.Vector3().subVectors(start, end).normalize();
                    const offset = bondDirection.clone().multiplyScalar(halfBondLength / 2);

                    const scale = new THREE.Vector3(1, 1, halfBondLength);

                    // first half of bond/atom
                    const instanceID1 = bondIndexLines;
                    const pos1 = new THREE.Vector3().copy(midpoint).add(offset);
                    
                    const matrix1 = new THREE.Matrix4().compose(pos1, quaternion, scale);
                    bondInstancedMeshLines.setMatrixAt(bondIndexLines, matrix1);
                    bondInstancedMeshLines.setColorAt(bondIndexLines, color1);
                    bondIndexLines++;

                    let atomName1 = atom1[7];
                    let atomElement1 = atom1[4];
                    let residue1 = atom1[5];
                    let resName1 = atom1[8];
                    let chain1 = atom1[6]; 

                    // second half of bond/atom
                    const instanceID2 = bondIndexLines;
                    const pos2 = new THREE.Vector3().copy(midpoint).sub(offset);
                    
                    const matrix2 = new THREE.Matrix4().compose(pos2, quaternion, scale);
                    bondInstancedMeshLines.setMatrixAt(bondIndexLines, matrix2);
                    bondInstancedMeshLines.setColorAt(bondIndexLines, color2);
                    bondIndexLines++;

                    let atomName2 = atom2[7];
                    let atomElement2 = atom2[4];
                    let residue2 = atom2[5];
                    let resName2 = atom2[8];
                    let chain2 = atom2[6];

                    // add metadata to array
                    let metadata1 = {
                            molecularElement: "atom",
                            drawingMethod: key,
                            atom1: atom1,
                            atom2: atom2,
                            atomName: atomName1,
                            atomElement: atomElement1,
                            residue: residue1, 
                            resName: resName1, 
                            chain: chain1,
                            printableString: resName1 + residue1.toString() + ':' + atomName1.toUpperCase(),
                            atomInfoSprite: null,
                            distanceLine: null,
                            originalColor: color1,
                            colorUpdated: false,
                            instanceID: instanceID1,
                            instancedMesh: bondInstancedMeshLines,
                            position: pos1,
                            atomPosition: start.clone(),
                            scale: scale.clone(),
                            quaternion: quaternion.clone(),
                            bondLength: bondLength,
                            bondDirection: bondDirection,
                            wireframe: false,
                            visible: false
                    };
                    
                    let metadata2 = {
                            molecularElement: "atom",
                            drawingMethod: key,
                            atom1: atom1,
                            atom2: atom2,
                            atomName: atomName2,
                            atomElement: atomElement2,
                            residue: residue2, 
                            resName: resName2, 
                            chain: chain2,
                            printableString: resName2 + residue2.toString() + ':' + atomName2.toUpperCase(),
                            atomInfoSprite: null,
                            distanceLine: null,
                            originalColor: color2,
                            colorUpdated: false,
                            instanceID: instanceID2,
                            instancedMesh: bondInstancedMeshLines,
                            position: pos2,
                            atomPosition: end.clone(),
                            scale: scale.clone(),
                            quaternion: quaternion.clone(),
                            bondLength: bondLength,
                            bondDirection: bondDirection,
                            wireframe: false,
                            visible: false
                    };

                    const tempMatrix = new THREE.Matrix4();
                    metadata1.instancedMesh.getMatrixAt(metadata1.instanceID, tempMatrix);
                    
                    const tempMatrix2 = new THREE.Matrix4();
                    metadata2.instancedMesh.getMatrixAt(metadata2.instanceID, tempMatrix2);
                   
                    // push metadata into map 
                    let bondKey1 = getKey(bondInstancedMeshLines, instanceID1);
                    metadataMap.set(bondKey1, metadata1);

                    let bondKey2 = getKey(bondInstancedMeshLines, instanceID2);
                    metadataMap.set(bondKey2, metadata2);
                
                    linesBonds ++;

                } else if (key == VDW) { // skip bonds for VDW
                    continue;
                }
            }
        }

        bondInstancedMeshCPK.count = bondIndexCPK;
        bondInstancedMeshCPK.instanceMatrix.needsUpdate = true;
        root.add(bondInstancedMeshCPK);

        bondInstancedMeshLines.count = bondIndexLines;
        bondInstancedMeshLines.instanceMatrix.needsUpdate = true;
        root.add(bondInstancedMeshLines);

        //console.log("CPKbonds", CPKbonds, "linesBonds", linesBonds);

        // make lines drawing method invisible when first loading molecule
        bondInstancedMeshLines.visible = false;

        let bondEndTime = new Date();
        calculateTime(bondStartTime, bondEndTime, 'time to load bonds');
    
        // push all instancedMeshes to array
        instancedMeshArray.push(atomInstancedMeshCPK, atomInstancedMeshVDW, bondInstancedMeshCPK, bondInstancedMeshLines);

        // render the scene after adding all the new atom & bond objects   
        render();

        getVisibleBoundingBox();

        let endTime = new Date();
        calculateTime(startTime, endTime, 'time to loadMolecule');

        if (callback) callback();

        popdown();
    } );
}

function hideText(repNum) {
    root.traverse( (obj) => {

        if ((obj.isSprite || obj.isLine) && obj.repNum == repNum) {
            obj.visible = false;
        }
    });
}

function showText(repNum) {
    root.traverse( (obj) => {

        if ((obj.isSprite || obj.isLine) && obj.repNum == repNum) {
            obj.visible = true;
        }
    });
}

function deleteText(repNum) {

    let objectsToRemove = [];

    root.traverse( (obj) => {
        if (obj.repNum == repNum) {

            if (obj.isSprite) {
                obj.material.map.dispose();  
                obj.material.dispose();
                objectsToRemove.push(obj);

            } else if (obj.isLine) {
                obj.material.dispose();
                obj.geometry.dispose();
                objectsToRemove.push(obj);
            }
        } 
    });

    objectsToRemove.forEach(obj => root.remove(obj));
}

// returns true if variable is string, false otherwise
function isString(variable) {
    return typeof variable === "string";
}

function findDistanceTarget(selectionValue) {

    console.log('in findDistanceTarget');

    // target array for distance calculations
    let target = [];
    let validResidues = {};

    if (isString(selectionValue)) { selectionValue = selectionValue.split(' '); }

    const distance = Number(selectionValue[0]);
    let type = selectionValue[1];
    let selected = selectionValue[2];

    //console.log('distance', distance, "type", type, "selected", selected);
    
    // find all target molecule atoms
    if (type == residue) {

        for (const [_, obj] of metadataMap) {
            if (obj.drawingMethod == CPK && obj.residue == selected) {
                // select by obj.drawingMethod == CPK because we just need one set of target atoms to compare distances with
                target.push([obj.position.x, obj.position.y, obj.position.z]);
            }
        }

    } else if (type == 'molecule') {

        for (const [_, obj] of metadataMap) {
            if (obj.drawingMethod == CPK && obj.chain == selected) {
                target.push([obj.position.x, obj.position.y, obj.position.z]);
            }
        }
    }
    
    //console.log('target in findDistanceTarget', target);

    // find all residues within the required distance to the target atoms

    for (const [_, obj] of metadataMap) {

        // check only the atoms that are the relevant rep and drawing method
        if (obj.molecularElement == 'atom' && obj.drawingMethod == CPK) { // just use CPK as target
            for (let coord of target) {

                let dist = calculateDistanceXYZ(coord, [obj.position.x, obj.position.y, obj.position.z]);

                if (dist <= distance) {
                    validResidues[obj.residue] = true;
                } 
            }
        }
    }
    
    return validResidues;
}

function isSelected(obj, selectionMethod, selectionValue, validResidues) {
    
    //console.log('in isSelected');
    /* console.log('obj', obj);
    console.log('selectionMethod', selectionMethod);
    console.log('selectionValue', selectionValue); */

    if (selectionValue == 'all') {
        return true;

    } else {

        if (obj.molecularElement == 'atom') {
            if (selectionMethod == 'atom') { // unimplemented, may remove

            } else if (selectionMethod == residue) {

                if (obj.residue == selectionValue) { return true; }

            } else if (selectionMethod == 'chain') {  
                //console.log('showMolecule, selecting by chain in atom');
                if (selectionValue == 'backbone') {
                    //console.log("obj.atomName", obj.atomName);

                    if (backboneAtoms.includes(obj.atomName)) { 
                        //console.log("obj.atomName", obj.atomName);
                        return true;
                    }

                } else {
                    if (obj.chain == selectionValue) {
                        return true;
                    } 
                }
                
            } else if (selectionMethod == 'distance') { 
                
                if (isString(selectionValue)) { selectionValue = selectionValue.split(' '); }

                let type = selectionValue[1];
                let selected = selectionValue[2];

                //console.log('type', type, 'selected', selected);

                if (isString(selected)) {
                    if (selected.toLowerCase() == 'ponatinib') {
                        selected = 'D';
                    } else if (selected.toLowerCase() == 'abl kinase') {
                        selected = 'A';
                    }
                }

                //console.log('in selectionMethod distancce of showMolecule', type);

                if (type == residue) {

                    // check if residue is within distance and if obj isn't part of the original target
                    if (validResidues[obj.residue] && obj.residue != selected) {
                        console.log('residue', obj.residue);
                        return true;
                    }

                } else if (type == 'molecule') {

                    if (validResidues[obj.residue] && obj.chain != selected) {
                        //console.log('obj', obj);
                        //console.log('set color of', obj, colorValue);
                        return true;
                    }
                }
            }

        } else if (obj.molecularElement == 'bond') {
            //console.log('object is bond');
            //console.log(obj);
            if (selectionMethod == 'atom') { // unimplemented, may remove

            } else if (selectionMethod == residue) {

                //console.log('selecting by residue in bond');
                let atom1 = obj.atom1;
                let atom2 = obj.atom2;

                /* console.log('atom1.residue', atom1.residue);
                console.log('atom2.residue', atom2.residue);
                console.log('selection', selection); */

                if (atom1[5] == selectionValue && atom2[5] == selectionValue) {
                    return true;
                }

            } else if (selectionMethod == 'chain') {

                let atom1 = obj.atom1;
                let atom2 = obj.atom2;

                if (selectionValue == 'backbone') {
                    if (backboneAtoms.includes(atom1[7]) && backboneAtoms.includes(atom2[7])) { 
                        return true;
                    } 
                } else {

                    if (atom1[6] == selectionValue && atom2[6] == selectionValue) {
                        return true;
                    } 
                }  
                
            } else if (selectionMethod == 'distance') {

                if (isString(selectionValue)) { selectionValue = selectionValue.split(' '); }
    
                let type = selectionValue[1];
                let selected = selectionValue[2];

                if (isString(selected)) {
                    if (selected.toLowerCase() == 'ponatinib') {
                        selected = 'D';
                    } else if (selected.toLowerCase() == 'abl kinase') {
                        selected = 'A';
                    }
                }
                
                let atom1 = obj.atom1;
                let atom2 = obj.atom2;
                //console.log(obj);

                if (type == residue) {

                    // check if residue is within distance and if obj isn't part of the original target
                    if (validResidues[atom1[5]] && validResidues[atom2[5]] && atom1[5] != selected && atom2[5] != selected) {
                        //console.log('residue', obj.residue);
                        //console.log('atom', obj.position.x, obj.position.y, obj.position.z);
                        return true;
                    }

                } else if (type == 'molecule') {

                    if (validResidues[atom1[5]] && validResidues[atom2[5]] && atom1[6] != selected && atom2[6] != selected) {
                        //console.log('residue', obj.residue);
                        //console.log('atom', obj.position.x, obj.position.y, obj.position.z);
                        return true;
                    } 
                }
            }
        }
    }
}

/**
 * 
 */
function parseRepInfo() {

    popup();

    // mark all objs as not visible
    for (const [_, obj] of metadataMap) {
        obj.visible = false;
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const position = obj.position;

        matrix.compose(position, quaternion, zeroScale);
        obj.instancedMesh.setMatrixAt(obj.instanceID, matrix);
    
        // hide all wireframes
        if (obj.wireframe) {
            obj.wireframe.visible = false;
        }

        // hide all lines and labels
        if (obj.distanceLine) {
            obj.distanceLine.visible = false;
        } 

        // hide all labels
        if (obj.atomInfoSprite) {
            obj.atomInfoSprite.visible = false;
        }
    }

    // update all instancedMeshes
    instancedMeshArray.forEach( mesh => {
        mesh.instanceMatrix.needsUpdate = true;
    });

    // loop backwards through repsData array to get reps from newest to oldest
    for (let i = repsData.length - 1; i >= 0; i--) { 

        let rep = repsData[i];
        let repID = rep.id;
        let drawingMethod = rep.drawingMethod;
        let coloringMethod = rep.coloringMethod;
        let selectionMethod = rep.selectionMethod;
        let selectionValue = rep.selectionValue;
        let state = rep.state;

        let validResidues;

        if (selectionMethod == 'distance') {
            validResidues = findDistanceTarget(selectionValue);
        }

        if (state != shown) {
            continue;
        }

        console.log('rep', repID, 'drawing method', drawingMethod);

        for (const [_, obj] of metadataMap) {
            //console.log(key, obj);

            if (obj.drawingMethod == drawingMethod && !obj.colorUpdated) { // if obj is atom or bond and color hasn't been updated yet
                
                if (isSelected(obj, selectionMethod, selectionValue, validResidues)) {
                    
                    // scale obj to be visible
                    const matrix = new THREE.Matrix4();
                    const quaternion = obj.quaternion;
                    const position = obj.position;
                    const scale = obj.scale;

                    matrix.compose(position, quaternion, scale);
                    obj.instancedMesh.setMatrixAt(obj.instanceID, matrix);

                    obj.visible = true;
                    obj.colorUpdated = true; 
                    obj.repID = currentRep;
                    setColor(obj, coloringMethod);

                    obj.instancedMesh.instanceMatrix.needsUpdate = true;

                    const tempMatrix = new THREE.Matrix4();
                    obj.instancedMesh.getMatrixAt(obj.instanceID, tempMatrix);

                    // make wireframe visible, if any
                    if (obj.wireframe) {
                        obj.wireframe.visible = true;
                    }

                    // make lines and labels visible, if any
                    if (obj.distanceLine) {
                        obj.distanceLine.visible = true;
                    } 

                    // make label visible, if any
                    if (obj.atomInfoSprite) {
                        obj.atomInfoSprite.visible = true;
                    }
                } 
            }
        }
    } 

    // update all instancedMeshes
    instancedMeshArray.forEach( mesh => {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.visible = true; 
    });

    // reset all colorUpdated to false
    for (const [_, obj] of metadataMap) {
        obj.colorUpdated = false; 
    }
    
    popdown();
}


function setColor(obj, colorValue) {

    let color;

    if (colorValue === blue) {                        
        color = new THREE.Color('rgb(0, 0, 255)'); 
    } else if (colorValue === green) {
        color = new THREE.Color('rgb(0, 255, 0)'); 
    } else if (colorValue === red) {
        color = new THREE.Color('rgb(255, 0, 0)'); 
    } else if (colorValue === name) {
        color = new THREE.Color(obj.originalColor); 
    }

    if (color) {
        obj.instancedMesh.setColorAt(obj.instanceID, color);
        obj.instancedMesh.instanceColor.needsUpdate = true;
    }
}


// helper functions for adding reps

// hides all rep contents and removes class='active' from all rep tabs
function hideAllReps() { 
    //console.log('in hideAllReps');

    // Get the container element
    const guiContainer = document.getElementsByClassName('three-gui')[0];

    // get all elements with class="tab-content-rep" and hide them
    const tabContents = Array.from(guiContainer.querySelectorAll('.tab-content-rep'));
    tabContents.forEach(content => content.style.display = 'none');

    // get all elements with class="tab-link-rep" and remove the class "active"
    const tabLinks = Array.from(guiContainer.querySelectorAll('.tab-link-rep'));
    tabLinks.forEach(link => link.classList.remove('active'));
}

// opens a rep's tab contents based on the tab clicked 
function openRepTab(repID) { 
    console.log('openRepTab', repID);

    hideAllReps();
    currentRep = repID; 
    showCurrentRep(currentRep);
    
    console.log("in openRepTab, currentRep", currentRep);
}

function getRandomColor() {
    const randomIndex = Math.floor(Math.random() * colorNames.length);
    return colorNames[randomIndex];
}

function getRandomShape() {
    const randomIndex = Math.floor(Math.random() * shapes.length);
    return shapes[randomIndex];
}

// creates tab buttons for reps
function createRepTabButton(repTabId, active) {
    const tabButton = document.createElement('button');
    tabButton.classList.add('tab-link-rep');
    tabButton.id = makeRepTabId(repTabId);
    tabButton.textContent = "rep " + getRandomShape(); 
    if (active) { tabButton.classList.add('active'); }
    tabButton.addEventListener('click', () => openRepTab(repTabId)); 

    return tabButton;
}

function findRepIndex(id) {
    return repsData.findIndex(rep => rep.id === id);
}

// shows a given rep number's contents and assigns class='active' to the tab
function showCurrentRep(repID) {

    console.log('in showCurrentRep, this is repID', repID);

    let repIndex = findRepIndex(repID);

    let repTabId = makeRepTabId(repID);
    let repContentId = makeRepContentId(repID);

    if (repsData[repIndex].state != hidden) {
        repsData[repIndex].state = shown;
        hideShowButton.textContent = 'hide rep';
    } else if (repsData[repIndex].state == hidden) {
        hideShowButton.textContent = 'show rep';
    }
        
    // add class 'active' to tab HTML element
    document.getElementById(repTabId).classList.add('active');
    document.getElementById(repTabId).style.display = 'block';
        
    // show currentRepGUI
    document.getElementById(repContentId).style.display = "block"; 
}

// functions to make IDs for tabs and tab contents

function makeRepTabId(id) {
    return 'rep-tab-' + id;
}

function makeRepContentId(id) {
    return 'rep-content-' + id;
}

function makeSMTabId(id, SMtype) {
    return SMtype + '-tab-' + id;
}

function makeSMContentId(id, SMtype) {
    return SMtype + '-content-' + id;
}


// when add rep button is clicked, add a new tab
function onAddRepClick () {
    if (numRepTabs < maxRepTabs) {
        numRepTabs++;

        createGUI();
        // console.log('in onAddRepClick, currentRep', currentRep);
        hideAllReps(); 
        showCurrentRep(currentRep);

        // show appropriate molecule 
        parseRepInfo();

    } else {
        console.log("Maximum number of GUIs reached");
    }
}


// when delete rep button is clicked, delete currently active rep
function onDeleteRepClick () {
    if (numRepTabs > 1) {
        
        numRepTabs--;

        let currentRepIndex = findRepIndex(currentRep);
        
        // delete appropriate HTML elements
        let repGUIdiv = document.getElementById(makeRepContentId(currentRep));
        console.log("currentRep", currentRep);
        console.log('makeRepContentId(currentRep)', makeRepContentId(currentRep));
        console.log(repGUIdiv);
        repGUIdiv.remove();

        let repTabButton = document.getElementById(makeRepTabId(currentRep));
        console.log(repTabButton);
        repTabButton.remove();

        // delete rep from repsData array
        repsData.splice(currentRepIndex, 1);

        // Hide appropriate portions of the molecule
        console.log('in onDeleteRepClick, deleting', currentRep); 

        deleteText(currentRep);  

        // show last added rep tab
        currentRep = repsData[repsData.length - 1].id;
        showCurrentRep(currentRep);

        parseRepInfo();

    } else {
        console.log("Cannot delete rep, only one left");
    }
}

// when hide rep button is clicked, hide/show currently active rep
function onHideShowRepClick () {

    console.log('in onHideShowRep with rep', currentRep);
    //console.log('repsData', repsData);
    let currentRepIndex = findRepIndex(currentRep);
    let currentTab = document.getElementById(makeRepTabId(currentRep));
    //console.log('currentRep', repsData[currentRepIndex]);

    let currentRepState = repsData[currentRepIndex].state;

    //console.log('rep is currently', currentRepState);
    
    if (currentRepState == shown) { // if molecule is shown, hide

        repsData[currentRepIndex].state = hidden;

        // hide appropriate molecule
        console.log('in onHideShowRepClick, hiding', currentRep, repsData[currentRepIndex]); 

        hideText(currentRep);
        parseRepInfo();

        // strike through text of current rep's tab
        let tabText = currentTab.textContent; 
        currentTab.innerHTML = '<del>' + tabText + '</del>';

        // change hide-show-button text to 'show rep'
        hideShowButton.textContent = 'show rep';

    } else if (currentRepState == hidden) { // if molecule is hidden, show

        repsData[currentRepIndex].state = shown;

        // show appropriate molecule
        console.log('in onHideShowRepClick, showing', currentRep, repsData[currentRepIndex]); 

        showText(currentRep);
        parseRepInfo();

        // un-strike through text of current rep's tab        
        currentTab.innerHTML = currentTab.textContent;

        // change hide-show-button text to 'hide rep'
        hideShowButton.textContent = 'hide rep';

    }
}

/**
 * Function to handle clicking hide/show questions button in right panel. 
 */
function onHideQuestions() {
    //console.log('in onHideQuestions');
    
    let rightCol = document.getElementsByClassName('column right')[0];
    let hideQuestionsButton = document.getElementById('hide-questions');

    if (rightCol.classList.contains('hidden')) {
        // Show the right column
        rightCol.classList.remove('hidden');
        hideQuestionsButton.innerHTML = 'hide questions';
    } else {
        // Hide the right column
        rightCol.classList.add('hidden');
        hideQuestionsButton.innerHTML = 'show questions';
    }

    onWindowResize();
}

/**
 * Function to handle clicking next/back button for activities in right panel. 
 */
function onNextBack() {
    //console.log('in onNextBack');
    
    let activity2 = document.getElementById('activity-2');
    let activity4 = document.getElementById('activity-4');
    let nextBackButton = document.getElementById('next-back');

    if (activity2.classList.contains('hidden')) {
        // show activity 2
        activity2.classList.remove('hidden');

        // hide activity 4
        activity4.classList.add('hidden');

        nextBackButton.innerHTML = 'next';
    } else {
        // show activity 4
        activity4.classList.remove('hidden');

        // hide activity 2
        activity2.classList.add('hidden');

        nextBackButton.innerHTML = 'back';
    }
}


// helper functions for creating selection method tabs and contents

function openSelectionMethodTab(event, SMtype) { 
    //console.log('in openSelectionMethodTab');
    //console.log('event.currentTarget.id', event.currentTarget.id);

    //console.log('currentRep', currentRep);
    const smContentId = makeSMContentId(currentRep, SMtype);
    const repContainer = document.getElementById('rep-content-' + currentRep);

    // get all elements with class="tab-content-selection-method" and hide them, within currentRep's div
    const tabContents = Array.from(repContainer.querySelectorAll('.tab-content-selection-method'));
    tabContents.forEach(content => content.style.display = 'none');

    // get all elements with class="tab-link" and remove the class "active"
    const tabLinks = Array.from(repContainer.querySelectorAll('.tab-link-selection-method'));
    tabLinks.forEach(link => link.classList.remove('active'));

    // show the current tab and add an "active" class to the button that opened the tab
    //console.log("document.getElementById(smContentId)", document.getElementById(smContentId));
    document.getElementById(smContentId).style.display = "block";
    //console.log("changed this smContentId to block", smContentId);
    event.currentTarget.classList.add('active');
}

// function to create tab buttons for selection methods
function createSelectionMethodTabButton(buttonText, active) {

    //console.log('currentRep', currentRep);

    const tabButton = document.createElement('button');
    tabButton.classList.add('tab-link-selection-method');
    tabButton.textContent = buttonText;
    tabButton.id = makeSMTabId(currentRep, buttonText.toLowerCase());
    if (active) { tabButton.classList.add('active'); }
    tabButton.addEventListener('click', (evt) => openSelectionMethodTab(evt, buttonText.toLowerCase()));

    return tabButton;
}

// function to create tab content for selection methods
function createSelectionMethodTabContent(SMtype, menus = [], display) {
    const tabContent = document.createElement('div');
    let smTabId = makeSMContentId(currentRep, SMtype);
    tabContent.id = smTabId;
    tabContent.classList.add('tab-content-selection-method', SMtype);
    if (!display) { tabContent.style.display = 'none'; }
    menus.forEach(menu => tabContent.appendChild(menu.domElement));

    return tabContent;
}

function generateTabID() {
    let id;
    
    do {
        id = '';
        for (let i = 0; i < 6; i++) {  // Adjust length as needed (6 characters here)
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (usedTabIDs.has(id));

    usedTabIDs.add(id);
    return id;
}

function addRepToRepsData(tabID) {
    repsData.push({ ...repDataDefault });  // clone default tab settings and add to repsData array
    repsData[repsData.length - 1].id = tabID; // set new rep ID
}

function createGUI() {

    // get container to hold all the GUIs 
    const moleculeGUIContainer = document.getElementsByClassName('three-gui')[0];

    let currentRepID = generateTabID();
    currentRep = currentRepID;
    addRepToRepsData(currentRepID);
    let repIndex = repsData.length - 1;

    // get tab rep container
    const tabRepContainer = document.getElementsByClassName("tab-rep")[0];
    
    // create tab button
    const tab = createRepTabButton(currentRepID, false);

    // append tab button to tab container
    tabRepContainer.appendChild(tab);

    // create new div for single GUI
    const moleculeGUIdiv = document.createElement('div');
    moleculeGUIdiv.classList.add('gui-div', 'tab-content-rep');
    const repContentId = makeRepContentId(currentRepID);
    moleculeGUIdiv.id = repContentId;

    // create new GUI
    const moleculeGUI = new GUI({ autoPlace: false }); 

    // creates a deep copy of defaultParams instead of referencing the original dictionary
    let params = JSON.parse(JSON.stringify(defaultParams));

    // store everything in their respective arrays 
    tabs[currentRepID] = tab;
    guis[currentRepID] = moleculeGUI; 
    guiContainers[currentRepID] = moleculeGUIdiv;

    // menus for the gui
    const styleMenu = moleculeGUI.add(params.repParams, 'representation', [CPK, VDW, lines]);
    const colorMenu = moleculeGUI.add(params.colorParams, 'color', [name, blue, green, red]);
    const residueMenu = moleculeGUI.add(params.residueParams, residue);
    const chainMenu = moleculeGUI.add(params.chainParams, 'chain'); 
    const withinMenu = moleculeGUI.add(params.withinParams, 'within');
    const withinDropdown = moleculeGUI.add(params.withinDropdownParams, 'withinDropdown', [residue, molecule]);
    const withinResMenu = moleculeGUI.add(params.withinResParams, 'withinRes');
    
    withinMenu.name('show all residues within');
    withinDropdown.name('of');
    withinResMenu.name('');
    styleMenu.name('drawing method');
    colorMenu.name('coloring method');
    chainMenu.name('molecule');


    // on change functions for GUIs

    residueMenu.onFinishChange((value) => { 
        console.log('changing rep', currentRep, 'to residue', value);

        if (!isNaN(value) && Number.isInteger(Number(value))) { // if value is not NaN and value is an integer
            //console.log("Number entered:", Number(value));

            if (residues[Number(value)]) { // value does exist in the residues list, this returns true

                residueSelected = Number(value); // set residueSelected to the residue we want to select
                
                repsData[repIndex].selectionMethod = residue;
                repsData[repIndex].selectionValue = residueSelected;
                parseRepInfo();

                deleteText(currentRep);
                deleteBondDistances();
                removeErrorMessages();

            } else { // value does not exist in the residues list

                displayErrorMessage("Please select a valid residue.");
                console.log("please select a valid residue");

            }
        } else if (value.toLowerCase() === "all") { // display entire molecule

            residueSelected = 'all';
            
            repsData[repIndex].selectionMethod = residue;
            repsData[repIndex].selectionValue = residueSelected;
            parseRepInfo();

            deleteText(currentRep);
            deleteBondDistances();
            removeErrorMessages();

        } else {
            // pop up text, flashing?
            displayErrorMessage("Invalid input. Please enter a number or 'all'.");
            console.log("Invalid input. Please enter a number or 'all'.");
        }
    })

    chainMenu.onFinishChange((value) => {

        if (value.toLowerCase() == 'abl kinase') {
            value = 'A';
        } else if (value.toLowerCase() == 'ponatinib') {
            value = 'D';
        } else if (value.toLowerCase() == 'water') {
            value = 'W';
        }

        if (chains.includes(value) || value.toLowerCase() == 'backbone') { // value does exist in the chains list or value is 'backbone'

            chainSelected = value;
            console.log('chainSelected', chainSelected);

            repsData[repIndex].selectionMethod = 'chain';
            repsData[repIndex].selectionValue = chainSelected;
            parseRepInfo();

            deleteText(currentRep);
            deleteBondDistances();
            removeErrorMessages();

        } else if (value == 'all') {

            repsData[repIndex].selectionMethod = 'chain';
            repsData[repIndex].selectionValue = value;
            parseRepInfo();

            deleteBondDistances(); 
            removeErrorMessages();

        } else { // value does not exist in the chains list

            displayErrorMessage("Please select a valid molecule.");
            console.log("please select a valid chain:", chains);

        }
    })

    colorMenu.onChange((value) => {
        console.log('changing color of', currentRep, 'to', value);
        let repIndex = findRepIndex(currentRep);
        repsData[repIndex].coloringMethod = value;
        parseRepInfo();
    })

    function displayErrorMessage (message) {
        let error_para = document.createElement('p');
        error_para.textContent = message;
        error_para.classList.add("error-para");
        errorContent.appendChild(error_para); 
    }

    function removeErrorMessages() {
        Array.from(document.getElementsByClassName('error-para')).forEach( (elem) => elem.remove() );
    }

    // helper function to validate residue number
    function validateResidue(resNum) {
        //console.log('in validateResidue');

        if (!isNaN(resNum) && Number.isInteger(Number(resNum))) { // if value is not NaN and value is an integer

            if (residues[resNum]) { // if value does exist in the residues list, this returns true
                Array.from(document.getElementsByClassName('error-para')).forEach( (elem) => elem.remove() );
                return resNum;

            } else { // value does not exist in the residues list

                let error_para = document.createElement('p');
                error_para.textContent = "Please select a valid residue.";
                error_para.classList.add("error-para");
                errorContent.appendChild(error_para); 

                console.log("please select a valid residue");
                return false;
            }
        } else {
            // pop up text, flashing?

            let error_para = document.createElement('p');
            error_para.textContent = "Invalid input. Please enter a number or 'all'.";
            error_para.classList.add("error-para");
            errorContent.appendChild(error_para); 

            console.log("Invalid input. Please enter a number or 'all'.");
            return false;
        }
    }

    // helper function to validate chain 
    function validateChain(chain) { // finish validate chain

        if (chain.toLowerCase() == 'abl kinase') {
            chain = 'A';
        } else if (chain.toLowerCase() == 'ponatinib') {
            chain = 'D';
        } else if (chain.toLowerCase() == 'water') {
            chain = 'W';
        }

        if (chains.includes(chain) || chain == 'backbone') { // value does exist in the chains list or value is 'backbone'

            chainSelected = chain;
            Array.from(document.getElementsByClassName('error-para')).forEach( (elem) => elem.remove() );

            return chain; 

        } else { // value does not exist in the chains list

            let error_para = document.createElement('p');
            error_para.textContent = "Please select a valid molecule.";
            error_para.classList.add("error-para");
            errorContent.appendChild(error_para); 

            console.log("please select a valid chain:", chains);
            return false;
        }
    }

    // helper function to highlight certain parts of the molecule based on the within ___ of residue ___ menu
    function withinAsResidue () {

        let startTime = new Date();
        //popup();

        const distance = params.withinParams.within;
        const type = params.withinDropdownParams.withinDropdown; 
        let value = params.withinResParams.withinRes;

        let currentRepIndex = findRepIndex(currentRep);

        if (value.toLowerCase() == 'ponatinib') {
            value = 'D';
        } else if (value.toLowerCase() == 'abl kinase') {
            value = 'A'
        } else if (value.toLowerCase() == 'water') {
            value = 'W';
        }

        //console.log("distance", distance, 'type', type, "value", value);

        if (type == residue) {

            let resNum = validateResidue(value);
            if (resNum != false) { // if residue is valid

                residueSelected = Number(resNum); // set residueSelected to the residue we want to select
                repsData[currentRepIndex].selectionMethod = 'distance';
                repsData[currentRepIndex].selectionValue = distance + " " + type + " " + value;
                
                deleteText(currentRep);
                deleteBondDistances();
                parseRepInfo();
            } 

        } else if (type == 'molecule') {
            
            let moleculeVal = validateChain(value);

            if (moleculeVal != false) {

                // maybe don't use global var chainSelected? might interfere with Selection method chain?
                chainSelected = moleculeVal; // set chainSelected to the chain we want to select
                //console.log('chainSelected', chainSelected);

                repsData[currentRepIndex].selectionMethod = 'distance';
                repsData[currentRepIndex].selectionValue = distance + " " + type + " " + value; // TODO edit here probably

                deleteText(currentRep);
                deleteBondDistances();
                parseRepInfo();
            } 
        }
        //popdown();

        let endTime = new Date();
        calculateTime(startTime, endTime, 'time to select by distance');

    }

    withinMenu.onFinishChange(withinAsResidue);
    withinDropdown.onFinishChange(withinAsResidue);
    withinResMenu.onFinishChange(withinAsResidue);

    styleMenu.onChange(function(value) {
        console.log('styleMenu changing to', value, 'with currentRep', currentRep);
        let currentRepIndex = findRepIndex(currentRep);
        repsData[currentRepIndex].drawingMethod = value;
        parseRepInfo();
    }); 

    // create div to hold molecule and representation options
    const molRepOptionContainer = document.createElement('div');
    molRepOptionContainer.classList.add('mol-rep-option');

    // create div to hold selection options, including [atom, residue, chain, distance]
    const selectionOptionContainer = document.createElement('div');
    selectionOptionContainer.classList.add('selection-option');
    const selectionTabContainer = document.createElement('div');
    selectionTabContainer.classList.add('tab-selection-method');

    // create tab buttons
    //const tabButtonAtom = createSelectionMethodTabButton('Atom', false);
    const tabButtonResidue = createSelectionMethodTabButton('Residue', true);
    const tabButtonChain = createSelectionMethodTabButton('Molecule', false);
    const tabButtonDistance = createSelectionMethodTabButton('Distance', false);

    // create tab content
    //const tabContentAtom = createSelectionMethodTabContent('atom', [atomMenu], false);
    const tabContentResidue = createSelectionMethodTabContent(residue, [residueMenu], true);
    const tabContentChain = createSelectionMethodTabContent(molecule, [chainMenu], false);
    const tabContentDistance = createSelectionMethodTabContent(distance, [withinMenu, withinDropdown, withinResMenu], false);

    // append tab buttons to tab container
    //selectionTabContainer.appendChild(tabButtonAtom);
    selectionTabContainer.appendChild(tabButtonResidue);
    selectionTabContainer.appendChild(tabButtonChain);
    selectionTabContainer.appendChild(tabButtonDistance);

    // append content to content container
    selectionOptionContainer.appendChild(selectionTabContainer);

    //selectionOptionContainer.appendChild(tabContentAtom);
    selectionOptionContainer.appendChild(tabContentResidue);
    selectionOptionContainer.appendChild(tabContentChain);
    selectionOptionContainer.appendChild(tabContentDistance);

    const selectionMethodPara = document.createElement('p');
    selectionMethodPara.classList.add("text");
    const text = document.createTextNode("SELECTION METHOD:");
    selectionMethodPara.appendChild(text);

    // molRepOptionContainer.appendChild(molMenu.domElement);
    molRepOptionContainer.appendChild(styleMenu.domElement);
    molRepOptionContainer.appendChild(colorMenu.domElement);

    // append everything to GUI div
    moleculeGUI.domElement.appendChild(molRepOptionContainer);
    moleculeGUI.domElement.appendChild(selectionMethodPara);
    moleculeGUI.domElement.appendChild(selectionOptionContainer);

    // add GUI to its container  
    moleculeGUIdiv.appendChild(moleculeGUI.domElement);
    moleculeGUIContainer.appendChild(moleculeGUIdiv);
        
    // default initialized setting: show rep 0 and hide all others
    tab.classList.add('active');
    tab.style.display = 'block';
    moleculeGUIdiv.style.display = 'block';

    currentStyle = defaultParams.repParams.representation;

    currentRep = currentRepID;
    console.log('currentRep', currentRep);

    return currentRepID;
}


function onWindowResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;

    if (camera.isPerspectiveCamera) {
        camera.aspect = w / h;
    } else if (camera.isOrthographicCamera) {
        const currentHeight = camera.top - camera.bottom;
        const newWidth = currentHeight * (w / h);
        const centerX = (camera.left + camera.right) / 2;

        camera.left = centerX - newWidth / 2;
        camera.right = centerX + newWidth / 2;
    }

    camera.updateProjectionMatrix();
    renderer.setSize(w, h);

    // keep camera centered on bounding box
    const center = getVisibleBoundingBox().getCenter(new THREE.Vector3());
    controls.setTarget(center.x, center.y, center.z);

    render();
}


// animate the molecule (allow it to move, be clicked)
function animate() {
    //console.log("animated")
    requestAnimationFrame( animate );

    // FPS
    if (framesOn) {
        frames ++;
        const time = performance.now();
        
        if ( time >= prevTime + 1000 ) {
        
            console.log( Math.round( ( frames * 1000 ) / ( time - prevTime ) ) );
        
        frames = 0;
        prevTime = time;
        }

        //controls.update();
        camera.updateProjectionMatrix();
    }

    render();
}


// render the molecule (adding scene and camera + objects)
function render() {
    renderer.render( scene, camera );
}

// keypress event functions

// on keypress 'd'
function keypressD(event) {
    if (event.key === 'd') {
        if (!isDistanceMeasurementMode) {
            isDistanceMeasurementMode = true;
            document.body.style.cursor = 'cell';
            if (!selectedObject) {
                console.log("in keypressD event, there is a selectedObject");
                resetAtomState(selectedObject); // reset selected atom state
            } else {
                console.log("in keypressD event, there was no a selectedObject");
            }
            console.log("Distance measurement mode activated");
        } else {
            isDistanceMeasurementMode = false;
            document.body.style.cursor = 'auto';
            console.log("Distance measurement mode deactivated");
        }
    }
}

// on keypress 'c'
function keypressC(event) {
    if (event.key === 'c') {
        if (!isCenterMode) {
            resetMouseModes();
            isCenterMode = true;
            console.log("Center mode activated");
            document.body.style.cursor = 'pointer';

        } else {
            isCenterMode = false;
            console.log("Center mode deactivated");
            document.body.style.cursor = 'auto';
        }
    }
}

// on keypress '='

function resetViewCameraWindow() {
    resetToInitialView();
    recenterCamera(camera, controls);
    onWindowResize();
}

function keypressEqual(event) {
    if (event.key === '=') {
        resetViewCameraWindow();
    }
}

function fitCameraToBoundingBox(camera, controls, boundingBox, padding = 1.2) {
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (camera.isPerspectiveCamera) {
        const distance = maxDim * 2.5;

        camera.position.set(center.x, center.y, center.z + distance);
        const aspect = container.clientWidth / container.clientHeight;
        const fov = 2 * Math.atan((maxDim / 2) / distance) * (180 / Math.PI);

        camera.fov = THREE.MathUtils.clamp(fov, 30, 75);
        camera.aspect = aspect;
        camera.near = 0.1;
        camera.far = maxDim * 10;

        controls.minDistance = maxDim * 0.5;
        controls.maxDistance = maxDim * 10;
        controls.setTarget(center.x, center.y, center.z);
        controls.update();

    } else if (camera.isOrthographicCamera) {
        
        let aspectRatio = window.innerWidth / window.innerHeight;

        let paddingFactor = 1.1;
        let viewSize = Math.max(size.x, size.y, size.z) * paddingFactor;

        let left = -aspectRatio * viewSize / 2;
        let right = aspectRatio * viewSize / 2;
        let top = viewSize / 2;
        let bottom = -viewSize / 2;
        let near = 0.01;   
        let far = 10000;   

        // Create the orthographic camera
        camera.left = left;
        camera.right = right;
        camera.top = top;
        camera.bottom = bottom;
        camera.near = near;
        camera.far = far;

        camera.position.set(center.x, center.y, center.z + maxDim * 2);

        controls.setLookAt(
            camera.position.x, camera.position.y, camera.position.z,  // camera position
            center.x, center.y, center.z   // look-at target
        );

        controls.update();
    }

    camera.updateProjectionMatrix();
}

function resetToInitialView() {

    camera.position.copy(initialPosition);
    camera.quaternion.copy(initialQuaternion);
    
    controls.setTarget(initialTarget.x, initialTarget.y, initialTarget.z);
    controls.reset(); 

    camera.updateProjectionMatrix();
}


const resetButton = document.getElementById('reset-everything');
resetButton.addEventListener("click", resetEverything); 

const clearButton = document.getElementById("clear-bonds");

clearButton.addEventListener("click", deleteBondDistances)


// help menu

const helpButton = document.getElementById('help-button');
const helpMenu = document.getElementById('help-menu');

helpButton.addEventListener('click', () => {
  if (helpMenu.style.display === 'none' || helpMenu.style.display === '') {
    helpMenu.style.display = 'block';
  } else {
    helpMenu.style.display = 'none';
  }
});

// If help menu is open, clicking anywhere else on the screen will close it
document.addEventListener('click', (event) => {
    if (!helpMenu.contains(event.target) && event.target !== helpButton) {
      helpMenu.style.display = 'none';
    }
});


// functions to manipulate atom states

function resetAtomState(atom) { // TODO FIGURE OUT HOW TO CHANGE ATOM COLOR

    // resets atom state to default non-wire frame and color
    if (atom == null) {
        return;
    }

    let currentColorValue = repsData[findRepIndex(currentRep)].coloringMethod;
    
    if (currentColorValue == name) {
        atom.material.color.set(new THREE.Color(atom.originalColor));
    } else if (currentColorValue == 'Blue') {
        atom.material.color.set(new THREE.Color('rgb(0, 0, 255)'));
    } else if (currentColorValue == 'Green') {
        atom.material.color.set(new THREE.Color('rgb(0, 255, 0)'));
    } else if (currentColorValue == 'Red') {
        atom.material.color.set(new THREE.Color('rgb(255, 0, 0)'));
    } 
 
    atom.material.wireframe = false; // TODO, can change representation once clicked 
    atom.material.emissive.set(0x000000);
    console.log("atom reset:", atom);
    return;
};

function removeWireFrame(atom) {

    if (atom.wireframe) {
        let wireframeSphere = atom.wireframe;
        wireframeSphere.geometry.dispose();
        wireframeSphere.material.dispose();
        root.remove(wireframeSphere);

        atom.wireframe = null;
        atomContent.innerHTML = '<p> selected atom: <br>none </p>'; 
    }
}

/**
 * 
 * @param {object} atom - atom metadata object
 */
// If atom has wireframe, remove wireframe. If atom doesn't have wireframe, add wireframe.
function switchAtomState(atom) { 

    console.log('ATOM', atom);
    if (atom.wireframe) {

        removeWireFrame(atom);

    } else {  
        
        if (atom.drawingMethod == lines) {
            console.log('trying to switch state of a lines atom');

            const position = atom.position;
            const scale = atom.scale;
            const quaternion = atom.quaternion;

            const wireframeGeometry = new THREE.BoxGeometry(0.08, 0.08, 1); 
            const wireframeMaterial = new THREE.MeshBasicMaterial({
                color: '#39FF14',     
                wireframe: true,
                transparent: true,
                opacity: 0.8,
            });

            const wireframeBox = new THREE.Mesh(wireframeGeometry, wireframeMaterial);

            wireframeBox.position.copy(position);
            wireframeBox.scale.copy(scale);
            wireframeBox.quaternion.copy(quaternion);

            atom.wireframe = wireframeBox;
            root.add(wireframeBox);

        } else { // drawing method is ball-and-stick or space filling
            console.log('trying to switch state of a sphere atom');

            const radius = getRadius(atom.atomElement);
            const color = atom.originalColor;

            const position = atom.position;
            const scale = atom.scale;

            const sphereScale = atom.drawingMethod == CPK ? sphereScaleCPK : sphereScaleVDW;

            const wireframeGeometry = new THREE.IcosahedronGeometry(sphereScale, detail); 
            const wireframeMaterial = new THREE.MeshBasicMaterial({
                color: '#39FF14',     
                wireframe: true,
                transparent: true,
                opacity: 0.8,
            });

            const wireframeSphere = new THREE.Mesh(wireframeGeometry, wireframeMaterial);

            wireframeSphere.position.copy(position);
            wireframeSphere.scale.copy(scale);

            atom.wireframe = wireframeSphere;
            root.add(wireframeSphere);
        }

        atomContent.innerHTML = '<p> selected atom: <br>' + atom.printableString + '<\p>';   
    }
}

function calculateDistanceXYZ(ls1, ls2) {
    let x1 = ls1[0];
    let y1 = ls1[1];
    let z1 = ls1[2];
    let x2 = ls2[0];
    let y2 = ls2[1];
    let z2 = ls2[2];

    let distance = ((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2)**(1/2);
    return distance.toFixed(4);
}

// Given two atoms, check existing lines drawn to see if the atoms have a line between them
// returns line object
function findExistingLine(atom1, atom2) {
    console.log('distanceLines', distanceLines);

    return distanceLines.find(line => {
        const [a1, a2] = line.atoms;
        return (a1 === atom1 && a2 === atom2) || (a1 === atom2 && a2 === atom1);
    });
}

// draw printableString next to atom
function drawAtomStr(atom) {

    // if info str already drawn, skip (for cases where distance is measured between an atom and itself)
    if (atom.atomInfoSprite) { return; }
    
    let x = atom.position.x;
    let y = atom.position.y;
    let z = atom.position.z;  
        
    let instancedMesh;

    if (atom.drawingMethod == CPK) { 
        instancedMesh = atomInstancedMeshCPK;
    } else if (atom.drawingMethod == VDW) { 
        instancedMesh = atomInstancedMeshVDW;
    } else if (atom.drawingMethod == lines) { 
        instancedMesh = bondInstancedMeshLines;
    } else { 
        console.log('Error, atom not VDW or CPK'); 
    }

    // create text to display atom printableString
    const canvas = document.createElement('canvas');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    canvas.width = containerWidth;
    canvas.height = containerHeight;

    const padding = 0.1;

    //console.log('container w h', containerWidth, containerHeight);

    const context = canvas.getContext('2d');

    context.fillStyle = 'green';
    context.font = '60px sans-serif';
    context.textAlign = 'center';   
    context.textBaseline = 'middle';  

    //console.log('atom.printableString', atom.printableString);

    context.fillText(atom.printableString, canvas.width/2, canvas.height/2);

    const textWidth = context.measureText(atom.printableString).width;

    // Create the texture from the canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create a SpriteMaterial with the canvas texture
    const textMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
    });

    // Create a Sprite using the material
    const sprite = new THREE.Sprite(textMaterial);
    sprite.repNum = currentRep; 
    
    // Set the size of the sprite (scale)
    sprite.scale.set(textSize, textSize, textSize); 

    const spriteScale = 0.005;
    
    const worldTextWidth = textWidth * spriteScale;
    //console.log('worldTextWidth', worldTextWidth);
    //sprite.position.set(x + worldTextWidth/1.1, y, z + worldTextWidth/1.1);

    sprite.position.set(x + worldTextWidth / 2 + 1/3 + padding, y, z); 

    atom.atomInfoSprite = sprite;

    root.add(sprite);

    renderer.render(scene, camera);
}

/**
 * Draws a white line between two selected atoms and labels line with distance (in angstroms)
 * 
 * @param {Object} object1 - atom
 * @param {Object} object2 - atom
 * @returns distance between two atoms in angstroms
 */
function drawLine(object1, object2) {

    let x1 = object1.position.x;
    let y1 = object1.position.y;
    let z1 = object1.position.z;
    let x2 = object2.position.x;
    let y2 = object2.position.y;
    let z2 = object2.position.z;

    console.log('objects', object1, object2);

    const material = new THREE.LineDashedMaterial( {
        color: 0xffffff,
        linewidth: 1,
        scale: 1,
        dashSize: 3,
        gapSize: 1,
    });

    /** Note: atoms that use line drawing method require additional handling because of the way boxes are
     * drawn in three.js - boxes are drawn from the center, not from an edge, so we take the atom 
     * position and offset it so that the end of the box coincides with the actual atom position. 
     * This means we store both the atomPosition (original position) and the position (offset position)
     * for atoms of the lines drawing method. */
    if (object1.drawingMethod == lines) {
        x1 = object1.atomPosition.x;
        y1 = object1.atomPosition.y;
        z1 = object1.atomPosition.z;
    }

    if (object2.drawingMethod == lines) {
        x2 = object2.atomPosition.x;
        y2 = object2.atomPosition.y;
        z2 = object2.atomPosition.z;
    } 

    const points = [];
    let pos1 = new THREE.Vector3(x1, y1, z1);
    let pos2 = new THREE.Vector3(x2, y2, z2);
    points.push(pos1, pos2);

    // calculate distance between two atoms
    let distance = (((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2)**(1/2)).toFixed(4);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // draw line between two atoms
    const line = new THREE.Line(geometry, material);
    root.add(line);
    object1.distanceLine = line;
    object2.distanceLine = line;
    distanceLines.push(line);

    line.atoms = [object1, object2];
    line.distance = distance;
    line.repNum = currentRep;

    // create text to display distance
    const canvas = document.createElement('canvas');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    canvas.width = containerWidth;  
    canvas.height = containerHeight; 

    const context = canvas.getContext('2d');

    context.fillStyle = 'green';
    context.font = '60px sans-serif';
    context.textAlign = 'center';   
    context.textBaseline = 'middle';  

    let x_cor = (x1 + x2) / 2;
    let y_cor = (y1 + y2) / 2; 
    let z_cor = (z1 + z2) / 2;

    context.fillText(distance, canvas.width/2, canvas.height/2);

    // create the texture from the canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // create a SpriteMaterial with the canvas texture
    const textMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
    });

    // create a Sprite using the material
    const sprite = new THREE.Sprite(textMaterial);

    // set the size of the sprite (scale)
    sprite.scale.set(textSize, textSize, textSize); 
    sprite.position.set(x_cor, y_cor+0.2, z_cor);
    line.add(sprite);

    renderer.render(scene, camera);

    return distance;
}

function deleteBondDistances() {    
    let objectsToRemove = [];

    // removes sprites (labels), lines, and wireframes
    root.traverse( (obj) => {
        
        if (obj.isSprite || obj.isLine || (obj.isMesh && obj.material && obj.material.wireframe)) {
            objectsToRemove.push(obj);
        }
    })

    objectsToRemove.forEach(obj => root.remove(obj));

    deleteHTMLBondLengths();
}

function deleteHTMLBondLengths() {
    let bondLengthHTMLElems = Array.from(document.getElementsByClassName("bond-length")); 

    bondLengthHTMLElems.forEach((elem) => { elem.remove(); })
}

// Resets all mouse modes to false and sets document cursor to auto
function resetMouseModes() {
    isDistanceMeasurementMode = false;
    isCenterMode = false;

    document.body.style.cursor = 'auto';
}


//--------------------------------------
// helper functions to draw frustrum ray to debug mouse clicking

// TODO something wrong with frustrum ray, figure out later
function vectorToString(v) {
    return "("+v.x.toFixed(2)+','+
        v.y.toFixed(2)+','+
        v.z.toFixed(2)+')';
}

function drawFrustumRay(mx,my) {
    var clickPositionNear = new THREE.Vector3( mx, my, 0 );
    var clickPositionFar  = new THREE.Vector3( mx, my, 1 );
    console.log("mx: "+mx+" my: "+my);
    clickPositionNear.unproject(camera);
    clickPositionFar.unproject(camera);
    console.log("click near: "+JSON.stringify(clickPositionNear));
    scene.add(createLine(clickPositionNear,clickPositionFar));
}

function createLine(a, b) {
    var geom = new THREE.BufferGeometry();

    // Define vertex positions as a Float32Array
    var vertices = new Float32Array([
        a.x, a.y, a.z,
        b.x, b.y, b.z
    ]);

    // Define colors for each vertex
    var colors = new Float32Array([
        1, 0, 0,  // Color for point 'a'
        0, 1, 0  // Color for point 'b'
    ]);

    // Assign attributes to geometry
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); // 3 values per vertex (x, y, z)
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3)); // RGB colors

    // Define material with vertex colors
    var mat = new THREE.LineBasicMaterial({ 
        vertexColors: true, // Enable per-vertex colors
        linewidth: 5 // Note: linewidth only works on Windows with WebGL1
    });

    return new THREE.Line(geom, mat);
}


function convertMousePositionToNDC(event) {
    var mx = event.clientX;
    var my = event.clientY;
    // console.log("click at ("+mx+","+my+")");
    var target = event.target;
    // console.log("clicked on "+target);
    var rect = target.getBoundingClientRect();
    var cx = mx - rect.left;
    var cy = my - rect.top;
    var winXSize = rect.width || (rect.right - rect.left);
    var winYSize = rect.height || (rect.bottom - rect.top);
    var winHalfXSize = winXSize/2;
    var winHalfYSize = winYSize/2;
    // these are in NDC
    var x = (cx - winHalfXSize) / winHalfXSize;
    var y = (winHalfYSize - cy) / winHalfYSize;
    // console.log("clicked on "+target+" at NDC ("+xNDC+","+xNDC+")");
    var click = {mx: mx, my: my,
                 cx: cx, cy: cy,
                 winXSize: winXSize,
                 winYSize: winYSize,
                 x: x, y: y};
    return click;
}

function handleMouseClick(mx,my,clickNear,clickFar) {
    scene.add(createLine(clickNear,clickFar));
}
//--------------------------------------


/**
 * Deals with mouse click on render screen. Gets objects intersecting with the mouse and deals with them.
 * Set drawRay to true if you want to draw the frustrum ray from mouse click (shift + click)
 * 
 * @param {Event} event - click event
 * (Sections adapted from Scott Anderson's raycasting code to draw frustrum ray from mouse click)
 */
function raycast(event) {

    if (drawRay) {
        if (event.shiftKey) {

            event.preventDefault();
            var click = convertMousePositionToNDC(event);
            var clickPositionNear = new THREE.Vector3( click.x, click.y, 0 );
            var clickPositionFar  = new THREE.Vector3( click.x, click.y, 1 );
        
            clickPositionNear.unproject(camera);
            clickPositionFar.unproject(camera);
        
            handleMouseClick(click.x, click.y, clickPositionNear, clickPositionFar );
        }
    }

    // get mouse's location specific to given container size 
    var rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; // Adjust for container's width
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; // Adjust for container's height

    camera.near = 0.1;
    camera.updateProjectionMatrix();

    raycaster.setFromCamera( mouse, camera );  
    raycaster.precision = 1;

    let intersects = raycaster.intersectObjects(scene.children);
    console.log("intersects", intersects);
   
    if (intersects.length > 0) { 
        let numAtoms = 0
        let currentAtom;
        let closestAtom = null;

        for (const obj of intersects) {

            if (obj.object.visible == true && obj.object.isInstancedMesh) {

                let instanceID = obj.instanceId;
                console.log('instancedID', instanceID);
                console.log("obj found", obj);

                if (obj.object.molecularElement == "atom") { // only atoms are clickable, bonds are not; check obj.molecularElement

                    let key = getKey(obj.object, instanceID);
                    closestAtom = metadataMap.get(key);
                    console.log('closest atom', closestAtom);
                    
                    break;
                }
            }
        }

        if (closestAtom != null) {
            currentAtom = closestAtom;
            numAtoms = numAtoms + 1;
        }
    
        if (numAtoms == 0) { return; }

        let previousAtom = selectedObject;
        selectedObject = currentAtom;

        console.log("previously selected atom is", previousAtom);
        console.log("currently selected atom is", currentAtom);

        if (isDistanceMeasurementMode) { // if selectionMode is on to measure distance between atoms

            if (distanceMeasurementAtoms.length == 0) {

                console.log('currently has one atom');
                distanceMeasurementAtoms.push(currentAtom); // distanceMeasurementAtoms array currently has 1 atom in it

                switchAtomState(currentAtom); 

                // if current atom has info printed, remove
                if (currentAtom.atomInfoSprite != null) {
                    let tempSprite = currentAtom.atomInfoSprite;
                    
                    tempSprite.material.map.dispose(); 
                    tempSprite.material.dispose();
                    tempSprite.geometry.dispose();

                    currentAtom.atomInfoSprite = null;  
                    root.remove(tempSprite);

                } else {
                    drawAtomStr(distanceMeasurementAtoms[0]);
                    console.log('drew atom str', currentAtom);
                }
                
                return;

            } else if (distanceMeasurementAtoms.length == 1) {

                distanceMeasurementAtoms.push(currentAtom); // distanceMeasurementAtoms array currently has 2 atoms in it
                console.log('currently has two atoms');
                switchAtomState(currentAtom);

                let existingLine = findExistingLine(distanceMeasurementAtoms[0], distanceMeasurementAtoms[1])

                if (existingLine) { // if the two atoms in distanceMeasurementAtoms have a line between them, delete the line and the atom info

                    // delete sprite associated with line
                    if (existingLine.children.length > 0) {
                        existingLine.children.forEach(child => {
                            
                            existingLine.remove(child); // Remove sprite from line
                            child.material.map.dispose(); // Free up GPU memory
                            child.material.dispose();
                            child.geometry.dispose();
                        });
                    }

                    // remove the line from the distanceLines array
                    distanceLines = distanceLines.filter(line => line !== existingLine);

                    // remove bond information from side panel
                    let bondLengthHTMLElems = Array.from(document.getElementsByClassName("bond-length")); 

                    for (let elem of bondLengthHTMLElems) {
                        if (elem.textContent == ("bond length: " + existingLine.distance + " angstroms")) {
                            elem.remove();
                        }
                    }

                    // delete line
                    root.remove(existingLine);
                    existingLine.geometry.dispose();
                    existingLine.material.dispose();

                    // delete atom info strings for each atom
                    for (let atom of distanceMeasurementAtoms) {
                        console.log('atom', atom);

                        if (atom.atomInfoSprite != null) {
                            let tempSprite = atom.atomInfoSprite;
                            
                            tempSprite.material.map.dispose();
                            tempSprite.material.dispose();        
                            atom.atomInfoSprite = null;  
                            root.remove(tempSprite);
                        }
                    }
                    console.log("Removed existing bond and labels");

                } else {
                    console.log("distanceMeasurementAtoms", distanceMeasurementAtoms);

                    let distance = drawLine(distanceMeasurementAtoms[0], distanceMeasurementAtoms[1]);
                    drawAtomStr(distanceMeasurementAtoms[1]);

                    // add bond length information to left panel
                    var bond_para = document.createElement('p')
                    bond_para.textContent = 'bond length: ' + distance + " angstroms";
                    bond_para.classList.add("bond-length");
                    bondLengthContent.appendChild(bond_para); 
                }
                
            } else {
                console.log("Too many atoms, cleared");
                distanceMeasurementAtoms = []; // clear array
                distanceMeasurementAtoms.push(currentAtom); // now the array has 1 atom in it

                switchAtomState(currentAtom);

                // if current atom has info printed, remove
                if (currentAtom.atomInfoSprite != null) {
                    let tempSprite = currentAtom.atomInfoSprite;
                    
                    tempSprite.material.map.dispose(); // Free up GPU memory
                    tempSprite.material.dispose();
                    tempSprite.geometry.dispose();

                    currentAtom.atomInfoSprite = null;  
                    root.remove(tempSprite);

                } else {
                    drawAtomStr(distanceMeasurementAtoms[0]);
                    console.log('drew atom str', currentAtom);
                }
                
                return;
            };

        } else if (isCenterMode) { 
            // center rotation around selected atom

            console.log('in isCenterMode');
            let camPos = camera.position.clone();
            console.log("camera.position before", camPos);

            let obj = selectedObject.instancedMesh;
            let instancedMesh = obj.instancedMesh;
            
            if (camera.isOrthographicCamera) { // orthographic camera, uses imported controls
                
                // Calculate the shift in target position
                const instanceMatrix = new THREE.Matrix4();
                const worldMatrix = new THREE.Matrix4();
                const worldPosition = new THREE.Vector3();

                instancedMesh.getMatrixAt(selectedObject.instanceID, instanceMatrix);
                worldMatrix.multiplyMatrices(instancedMesh.matrixWorld, instanceMatrix);
                worldMatrix.decompose(worldPosition, new THREE.Quaternion(), new THREE.Vector3());

                controls.setOrbitPoint(worldPosition.x, worldPosition.y, worldPosition.z);
                
                //camera.position.copy(camPos);
                //camera.lookAt(prevTarget);
                //camera.setViewOffset(w, h, objWorldPosition.x, objWorldPosition.y, w, h);
                console.log("camera.position after", camera.position);

            } else {
                // TODO perspective camera 
            }

            return;

        } else { // not distance measurement or centering mode
            if (!(previousAtom == null)) { // if there was a previously-selected object
                if (previousAtom == currentAtom) { // if previous selected object is the same as currently selected object
                    switchAtomState(currentAtom); // switch current atom's state
                    return;
                } else { // if clicking on a different atom
                    removeWireFrame(previousAtom); // reset previously-clicked atom
                    switchAtomState(currentAtom); // switch current atom's state
                    return;
                };
            } else { // if there was no previously-selected object
                switchAtomState(currentAtom); // switch current atom's state
                return;
            }            
        };  
    } 
} 

/**
 * Make loading screen appear
 */
function popup() {
    let popup = document.getElementById("loading-popup");
    popup.style.display = 'block';
}

/**
 * Make loading screen disappear
 */
function popdown() {
    let popup = document.getElementById("loading-popup");
    popup.style.display = "none";
} 


/**
 * Get radius size of a given atom element
 */
function getRadius(atom) {
    const radii = {
        br: 1.83,
        c: 1.7,
        cl: 1.75,
        f: 1.35,
        h: 1.2,
        n: 1.55,
        o: 1.52,
        s: 1.80,
    };

    atom = atom.toLowerCase();
    const radius = radii[atom];

    if (radius == undefined) {
        return 1;
    }

    return radius;
}
