import * as THREE from 'three';

import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawUtils } from 'three/addons/utils/LDrawUtils.js';

let container, progressBarDiv;

let guiData;
import { camera, scene, renderer, controls, gui } from './main.js';
import { transform } from './main.js';
let mesh, folder_model;
const ldrawPath = 'models/ldraw/officialLibrary/';

const modelFileList = {
    'Car': 'models/car.ldr_Packed.mpd',
    'Lunar Vehicle': 'models/1621-1-LunarMPVVehicle.mpd_Packed.mpd',
    'Radar Truck': 'models/889-1-RadarTruck.mpd_Packed.mpd',
    'Trailer': 'models/4838-1-MiniVehicles.mpd_Packed.mpd',
    'Bulldozer': 'models/4915-1-MiniConstruction.mpd_Packed.mpd',
    'Helicopter': 'models/4918-1-MiniFlyers.mpd_Packed.mpd',
    'Plane': 'models/5935-1-IslandHopper.mpd_Packed.mpd',
    'Lighthouse': 'models/30023-1-Lighthouse.ldr_Packed.mpd',
    'X-Wing mini': 'models/30051-1-X-wingFighter-Mini.mpd_Packed.mpd',
    'AT-ST mini': 'models/30054-1-AT-ST-Mini.mpd_Packed.mpd',
    'AT-AT mini': 'models/4489-1-AT-AT-Mini.mpd_Packed.mpd',
    'Shuttle': 'models/4494-1-Imperial Shuttle-Mini.mpd_Packed.mpd',
    'TIE Interceptor': 'models/6965-1-TIEIntercep_4h4MXk5.mpd_Packed.mpd',
    'Star fighter': 'models/6966-1-JediStarfighter-Mini.mpd_Packed.mpd',
    'X-Wing': 'models/7140-1-X-wingFighter.mpd_Packed.mpd',
    'AT-ST': 'models/10174-1-ImperialAT-ST-UCS.mpd_Packed.mpd'
};

export function init_models() {
    folder_model = gui.addFolder("Models")
    guiData = {
        modelFileName: modelFileList['Car'],
        displayLines: true,
        conditionalLines: true,
        smoothNormals: true,
        buildingStep: 0,
        noBuildingSteps: 'No steps.',
        flatColors: false,
        mergeModel: false
    };

    progressBarDiv = document.createElement('div');
    progressBarDiv.innerText = 'Loading...';
    progressBarDiv.style.fontSize = '3em';
    progressBarDiv.style.color = 'blue';
    progressBarDiv.style.display = 'block';
    progressBarDiv.style.position = 'absolute';
    progressBarDiv.style.top = '50%';
    progressBarDiv.style.width = '100%';
    progressBarDiv.style.textAlign = 'center';

    reloadObject(true);
}
export function remove_models() {
    scene.remove(mesh);
    gui.removeFolder(folder_model)
}

function updateObjectsVisibility() {
    mesh.traverse(c => {

        if (c.isLineSegments) {

            if (c.isConditionalLine) {

                c.visible = guiData.conditionalLines;

            } else {

                c.visible = guiData.displayLines;

            }

        } else if (c.isGroup) {

            // Hide objects with building step > gui setting
            c.visible = c.userData.buildingStep <= guiData.buildingStep;

        }

    });

}

function reloadObject(resetCamera) {
    if (mesh) {
        scene.remove(mesh);
    }
    updateProgressBar(0);
    showProgressBar();

    // only smooth when not rendering with flat colors to improve processing time
    const lDrawLoader = new LDrawLoader();
    lDrawLoader.smoothNormals = guiData.smoothNormals && !guiData.flatColors;
    lDrawLoader
        .setPath(ldrawPath)
        .load(guiData.modelFileName, function (group2) {

            if (mesh) {
                scene.remove(mesh);
            }

            mesh = group2;

            // demonstrate how to use convert to flat colors to better mimic the lego instructions look
            if (guiData.flatColors) {

                function convertMaterial(material) {

                    const newMaterial = new THREE.MeshBasicMaterial();
                    newMaterial.color.copy(material.color);
                    newMaterial.polygonOffset = material.polygonOffset;
                    newMaterial.polygonOffsetUnits = material.polygonOffsetUnits;
                    newMaterial.polygonOffsetFactor = material.polygonOffsetFactor;
                    newMaterial.opacity = material.opacity;
                    newMaterial.transparent = material.transparent;
                    newMaterial.depthWrite = material.depthWrite;
                    newMaterial.toneMapping = false;

                    return newMaterial;

                }

                mesh.traverse(c => {

                    if (c.isMesh) {

                        if (Array.isArray(c.material)) {

                            c.material = c.material.map(convertMaterial);

                        } else {

                            c.material = convertMaterial(c.material);

                        }

                    }

                });

            }

            // Merge model geometries by material
            if (guiData.mergeModel) mesh = LDrawUtils.mergeObject(mesh);

            // Convert from LDraw coordinates: rotate 180 degrees around OX
            mesh.rotation.x = Math.PI;
            mesh.scale.set(0.5, 0.5, 0.5);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            scene.add(mesh);
            transform(mesh);

            guiData.buildingStep = mesh.userData.numBuildingSteps - 1;

            updateObjectsVisibility();

            createGUI();

            hideProgressBar();

        }, onProgress, onError);

}

function createGUI() {
    if (folder_model) {
        const controllers = folder_model.__controllers;
        while (controllers.length) {
            folder_model.remove(controllers[0]);
        }
    } else {
        folder_model = gui.addFolder("Models");
    }

    folder_model.add(guiData, 'modelFileName', modelFileList).name('Model').onFinishChange(function () {
        reloadObject(true);
    });

    folder_model.add(guiData, 'flatColors').name('Flat Colors').onChange(function () {

        reloadObject(false);

    });

    if (mesh.userData.numBuildingSteps > 1) {

        folder_model.add(guiData, 'buildingStep', 0, mesh.userData.numBuildingSteps - 1).step(1).name('Building step').onChange(updateObjectsVisibility);

    } else {

        folder_model.add(guiData, 'noBuildingSteps').name('Building step').onChange(updateObjectsVisibility);

    }

    folder_model.add(guiData, 'smoothNormals').name('Smooth Normals').onChange(function changeNormals() {

        reloadObject(false);

    });

    folder_model.add(guiData, 'displayLines').name('Display Lines').onChange(updateObjectsVisibility);
    folder_model.add(guiData, 'conditionalLines').name('Conditional Lines').onChange(updateObjectsVisibility);

}

function onProgress(xhr) {

    if (xhr.lengthComputable) {

        updateProgressBar(xhr.loaded / xhr.total);

        console.log(Math.round(xhr.loaded / xhr.total * 100, 2) + '% downloaded');

    }

}

function onError(error) {

    const message = 'Error loading model';
    progressBarDiv.innerText = message;
    console.log(message);
    console.error(error);
}

function showProgressBar() {

    document.body.appendChild(progressBarDiv);

}

function hideProgressBar() {

    document.body.removeChild(progressBarDiv);

}

function updateProgressBar(fraction) {

    progressBarDiv.innerText = 'Loading... ' + Math.round(fraction * 100, 2) + '%';

}