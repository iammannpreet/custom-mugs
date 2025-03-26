import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import Mug from "./assets/model1.glb";

const ModelMug = () => {
    // Refs for DOM elements
    const containerRef = useRef(null);
    const imageSelectorRef = useRef(null);
    const colorSelectorRef = useRef(null);

    // Refs for Three.js objects that need to persist between renders
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const orbitControlsRef = useRef(null);
    const meshRef = useRef(null);
    const decalGeometryRef = useRef(null);
    const materialRef = useRef(null);

    // Initialize Three.js scene
    const initScene = useCallback(() => {
        if (!containerRef.current) return;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(20, 1000 / 1000, 1e-5, 1e10);
        cameraRef.current = camera;
        scene.add(camera);

        const hemispheric = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
        scene.add(hemispheric);

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            logarithmicDepthBuffer: true,
            alpha: true,
        });
        renderer.setClearColor(0x131316, 0);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(800, 800);
        renderer.outputEncoding = THREE.sRGBEncoding;
        rendererRef.current = renderer;

        containerRef.current.appendChild(renderer.domElement);

        const orbitControls = new OrbitControls(camera, renderer.domElement);
        orbitControlsRef.current = orbitControls;

        return { scene, camera, renderer, orbitControls };
    }, []);

    // Convert image URL to Three.js texture
    const convertImageToTexture = useCallback((imageUrl) => {
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(imageUrl);
        texture.encoding = THREE.sRGBEncoding;
        return texture;
    }, []);

    // Handle texture selection
    const setupTextureSelector = useCallback(() => {
        if (!imageSelectorRef.current || !materialRef.current) return;

        const handleTextureChange = (event) => {
            if (materialRef.current) {
                materialRef.current.map = convertImageToTexture(URL.createObjectURL(event.target.files[0]));
            }
        };
        imageSelectorRef.current.addEventListener("input", handleTextureChange);

        return () => {
            if (imageSelectorRef.current) {
                imageSelectorRef.current.removeEventListener("input", handleTextureChange);
            }
        };
    }, [convertImageToTexture]);

    // Handle color selection
    const setupColorSelector = useCallback((material) => {
        if (!colorSelectorRef.current) return;

        const handleColorChange = (event) => {
            material.color.set(event.target.value);
        };

        colorSelectorRef.current.addEventListener("input", handleColorChange);

        return () => {
            if (colorSelectorRef.current) {
                colorSelectorRef.current.removeEventListener("input", handleColorChange);
            }
        };
    }, []);

    // Load the 3D model
    const loadModel = useCallback(() => {
        if (!sceneRef.current || !cameraRef.current || !orbitControlsRef.current) return;

        const scene = sceneRef.current;
        const camera = cameraRef.current;
        const orbitControls = orbitControlsRef.current;

        const loader = new GLTFLoader();
        const cameraPos = new THREE.Vector3(-0.2, 0.4, 1.4);

        loader.load(
            Mug,
            (gltf) => {
                const object = gltf.scene;

                if (rendererRef.current) {
                    const pmremGenerator = new THREE.PMREMGenerator(rendererRef.current);
                    pmremGenerator.compileEquirectangularShader();
                }

                object.updateMatrixWorld();
                const boundingBox = new THREE.Box3().setFromObject(object);
                const modelSizeVec3 = new THREE.Vector3();
                boundingBox.getSize(modelSizeVec3);
                const modelSize = modelSizeVec3.length();
                const modelCenter = new THREE.Vector3();
                boundingBox.getCenter(modelCenter);

                orbitControls.reset();
                orbitControls.maxDistance = modelSize * 50;
                orbitControls.enableDamping = true;
                orbitControls.dampingFactor = 0.07;
                orbitControls.rotateSpeed = 1.25;
                orbitControls.panSpeed = 1.25;
                orbitControls.screenSpacePanning = true;
                orbitControls.autoRotate = true;

                object.position.x = -modelCenter.x;
                object.position.y = -modelCenter.y;
                object.position.z = -modelCenter.z;
                camera.position.copy(modelCenter);
                camera.position.x += modelSize * cameraPos.x;
                camera.position.y += modelSize * cameraPos.y;
                camera.position.z += modelSize * cameraPos.z;
                camera.near = modelSize / 100;
                camera.far = modelSize * 100;
                camera.updateProjectionMatrix();
                camera.lookAt(modelCenter);

                object.traverse((obj) => {
                    if (obj instanceof THREE.Mesh && obj.name === "Mug_Porcelain_PBR001_0") {
                        materialRef.current = obj.material;
                        meshRef.current = obj;
                        setupTextureSelector();
                    } else if (obj instanceof THREE.Mesh && obj.name === "Mug_Porcelain_PBR002_0") {
                        const material = obj.material;
                        setupColorSelector(material);
                    }
                });
                scene.add(object);
            },
            undefined,
            (error) => {
                console.error(error);
            }
        );
    }, [setupColorSelector, setupTextureSelector]);

    // Animation loop
    const animate = useCallback(() => {
        if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !orbitControlsRef.current) return;

        const scene = sceneRef.current;
        const camera = cameraRef.current;
        const renderer = rendererRef.current;
        const orbitControls = orbitControlsRef.current;

        const animationId = requestAnimationFrame(animate);

        orbitControls.update();
        renderer.render(scene, camera);

        return animationId;
    }, []);

    // Initialize everything
    useEffect(() => {
        initScene();
        loadModel();

        const animationId = animate();

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            if (rendererRef.current && containerRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
            if (decalGeometryRef.current) {
                decalGeometryRef.current.dispose();
            }
        };
    }, [initScene, loadModel, animate]);

    const download = () => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;

        if (orbitControlsRef.current) {
            orbitControlsRef.current.update();
        }

        renderer.render(scene, camera);

        const captureCanvas = document.createElement("canvas");
        captureCanvas.width = renderer.domElement.width;
        captureCanvas.height = renderer.domElement.height;
        const context = captureCanvas.getContext("2d");

        context.drawImage(renderer.domElement, 0, 0);

        const dataURL = captureCanvas.toDataURL("image/png", 1.0);

        const link = document.createElement("a");
        link.href = dataURL;
        link.download = "custom-mug.png";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="container">
            <div className="preview">
                <div className="controls">
                    <div className="control-option">
                        <p>1.</p>
                        <input
                            type="file"
                            accept="image/*"
                            id="imageSelector"
                            name="imageSelector"
                            ref={imageSelectorRef}
                        />
                    </div>
                    <div className="control-option">
                        <p>2. Pick your color:</p>
                        <input
                            type="color"
                            id="colorPicker"
                            name="colorPicker"
                            defaultValue="#ffffff"
                            ref={colorSelectorRef}
                        />
                    </div>
                    <div className="control-option">
                        <p>3. Get the design:</p>
                        <button onClick={download}>Download</button>
                    </div>
                </div>
                <div ref={containerRef} />
            </div>
        </div>
    );
};

export default ModelMug;