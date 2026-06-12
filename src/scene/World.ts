import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import modelUrl from '@/assets/models/cloud-from-world-of-final-fantasy.glb?url'
import { getRenderPixelRatio } from '@/config/rendering'
import { getThemeMirrorTint, getThemeSurfaceColor, type ThemeMode } from '@/state/themeState'

// --- 参数配置区 ---
const REFLECTION_OPACITY = 0.4
const SHOW_MARKER = false

export class World {
  scene: THREE.Scene
  groundMirror: Reflector
  originMarker: THREE.Mesh
  model: THREE.Group | null = null
  mixer: THREE.AnimationMixer | null = null
  private sceneSurfaceColor = getThemeSurfaceColor()
  private ambientLight: THREE.AmbientLight
  private dirLight: THREE.DirectionalLight
  private disposed = false

  constructor(scene: THREE.Scene) {
    this.scene = scene

    // Ambient Light and Directional Light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 2)
    scene.add(this.ambientLight)

    this.dirLight = new THREE.DirectionalLight(0xffffff, 3)
    this.dirLight.position.set(10, 20, 10)
    scene.add(this.dirLight)

    // 添加镜面反射地面。
    const mirrorGeometry = new THREE.PlaneGeometry(100, 100)

    // 改写内置 Shader，使其支持自定义透明度（opacity）。
    const reflectorShader = (Reflector as any).ReflectorShader
    const customShader = {
      name: 'ReflectorShaderWithAlpha',
      uniforms: {
        ...reflectorShader.uniforms,
        reflectionOpacity: { value: REFLECTION_OPACITY },
        surfaceColor: { value: new THREE.Color(this.sceneSurfaceColor) },
      },
      vertexShader: reflectorShader.vertexShader,
      fragmentShader: `
        uniform float reflectionOpacity;
        uniform vec3 surfaceColor;
        ${reflectorShader.fragmentShader.replace(
          'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
          `
            vec3 reflectedColor = blendOverlay( base.rgb, color );
            float reflectionMask = smoothstep( 0.02, 0.28, distance( base.rgb, surfaceColor ) );
            gl_FragColor = vec4( reflectedColor, reflectionMask * reflectionOpacity );
          `,
        )}
      `,
    }

    this.groundMirror = new Reflector(mirrorGeometry, {
      clipBias: 0.003,
      textureWidth: window.innerWidth * getRenderPixelRatio(),
      textureHeight: window.innerHeight * getRenderPixelRatio(),
      color: getThemeMirrorTint(),
      shader: customShader,
    })

    // 必须开启此选项，才能让自定义透明度生效。
    const groundMirrorMaterial = this.groundMirror.material as THREE.Material
    groundMirrorMaterial.transparent = true
    groundMirrorMaterial.depthWrite = false

    this.groundMirror.rotateX(-Math.PI / 2)
    this.groundMirror.position.y = -2.5 // 初始估算高度，会在模型加载后修正。
    scene.add(this.groundMirror)

    // 补丁：让真实场景透明以透出 ASCII，同时让镜面在渲染倒影时仍认为背景是纯白色。
    // 这样镜面边界会自然隐藏，不会变成突兀的灰色平面。
    const originalOnBeforeRender = this.groundMirror.onBeforeRender.bind(this.groundMirror)
    const world = this
    this.groundMirror.onBeforeRender = function (
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      camera: THREE.Camera,
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      group: THREE.Group,
    ) {
      const prevBg = scene.background
      scene.background = new THREE.Color(world.sceneSurfaceColor)
      originalOnBeforeRender(renderer, scene, camera, geometry, material, group)
      scene.background = prevBg
    }

    // 添加位于原点 (0, 0, 0) 的红色定位参考小球。
    const markerGeometry = new THREE.SphereGeometry(0.1, 16, 16)
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    this.originMarker = new THREE.Mesh(markerGeometry, markerMaterial)
    this.originMarker.visible = SHOW_MARKER
    scene.add(this.originMarker)

    // 加载模型。
    this.loadModel()
  }

  private loadModel() {
    const loader = new GLTFLoader()

    loader.load(modelUrl, (gltf) => {
      if (this.disposed) {
        disposeObject3D(gltf.scene)
        return
      }

      this.model = gltf.scene

      // Compute bounding box to set proper scale and position
      const box = new THREE.Box3().setFromObject(this.model)
      const size = box.getSize(new THREE.Vector3())

      const maxDim = Math.max(size.x, size.y, size.z)
      const targetDim = 5
      const scale = targetDim / maxDim
      this.model.scale.setScalar(scale)

      // Recompute box after scaling to properly center
      const box2 = new THREE.Box3().setFromObject(this.model)
      const center2 = box2.getCenter(new THREE.Vector3())

      // Center model at origin
      this.model.position.sub(center2)

      // 精确将镜面放置在模型正下方。
      const groundY = -box2.getSize(new THREE.Vector3()).y / 2
      this.groundMirror.position.y = groundY

      // 同步将红色定位小球贴在地面上。
      this.originMarker.position.y = groundY

      // 为了保持视觉平衡，将模型相对前移。
      this.model.position.x += 0.5
      this.model.position.z += 0.3
      this.model.position.y -= 0.03

      // 导入并播放模型中的动画。
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.model)
        gltf.animations.forEach((clip) => {
          this.mixer!.clipAction(clip).play()
        })
      }

      this.scene.add(this.model)
    })
  }

  /** 更新模型动画混合器。 */
  update(delta: number) {
    if (this.mixer) {
      this.mixer.update(delta)
    }
  }

  /** 窗口缩放时更新镜面的渲染目标分辨率。 */
  onResize() {
    this.groundMirror.getRenderTarget().setSize(
      window.innerWidth * getRenderPixelRatio(),
      window.innerHeight * getRenderPixelRatio(),
    )
  }

  setTheme(mode: ThemeMode) {
    this.sceneSurfaceColor = getThemeSurfaceColor(mode)
    const material = this.groundMirror.material as THREE.ShaderMaterial
    if (material.uniforms.color?.value instanceof THREE.Color) {
      material.uniforms.color.value.set(getThemeMirrorTint(mode))
    }
    if (material.uniforms.surfaceColor?.value instanceof THREE.Color) {
      material.uniforms.surfaceColor.value.set(this.sceneSurfaceColor)
    }
  }

  dispose() {
    this.disposed = true

    if (this.mixer && this.model) {
      this.mixer.stopAllAction()
      this.mixer.uncacheRoot(this.model)
    }
    this.mixer = null

    if (this.model) {
      this.scene.remove(this.model)
      disposeObject3D(this.model)
      this.model = null
    }

    this.scene.remove(this.groundMirror)
    this.groundMirror.getRenderTarget().dispose()
    this.groundMirror.geometry.dispose()
    disposeMaterial(this.groundMirror.material)

    this.scene.remove(this.originMarker)
    this.originMarker.geometry.dispose()
    disposeMaterial(this.originMarker.material)

    this.scene.remove(this.ambientLight)
    this.scene.remove(this.dirLight)
  }
}

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return

    mesh.geometry?.dispose()
    disposeMaterial(mesh.material)
  })
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial)
    return
  }

  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose()
    }
  }

  material.dispose()
}
