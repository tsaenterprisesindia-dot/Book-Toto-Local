import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const FaceContext = createContext(null);

const MODELS_URL =
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

export function FaceProvider({ children }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const apiRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const loadFaceApi = async () => {
    if (apiRef.current) return;
    setLoading(true);
    setLoadError('');
    try {
      if (!window.faceapi) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.body.appendChild(s);
        });
      }
      const api = window.faceapi;
      apiRef.current = api;

      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
        api.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
        api.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
      ]);
      setReady(true);
    } catch (e) {
      const msg = e?.message || 'Could not load face recognition library';
      setLoadError(msg);
      console.error('[frs] load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load the face engine up front so the standalone /face-login page works
    // even before the user is authenticated.
    loadFaceApi();
    return () => {
      stopStream();
    };
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, message: 'Camera is not available in this browser.' };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await new Promise((resolve) => (videoRef.current.onplaying = resolve));
      return { ok: true };
    } catch (e) {
      const name = e?.name;
      const messages = {
        NotAllowedError: 'Camera permission denied. Allow camera access in your browser settings.',
        NotFoundError: 'No camera found on this device.',
        NotReadableError: 'Camera is already in use. Close other camera apps and try again.',
      };
      return { ok: false, message: messages[name] || `Camera error: ${name || e?.message}` };
    }
  };

  // face-api.js: detect landmarks, then compute the 128-d recognizer descriptor.
  const captureDescriptor = async () => {
    const api = apiRef.current;
    const video = videoRef.current;
    if (!api || !video) return { ok: false, message: 'Face engine not ready' };
    try {
      const options = new api.SsdMobilenetv1Options({ minConfidence: 0.6 });
      const detections = await api.detectSingleWithFaceLandmarks(video, false, options);
      if (!detections) {
        return { ok: false, message: 'No clear face detected. Center your face and try again.' };
      }
      let descriptor = null;
      if (typeof detections.withFaceRecognizer === 'function') {
        const res = await detections.withFaceRecognizer();
        descriptor = res?.descriptor;
      }
      if (!descriptor && api.nets?.faceRecognitionNet) {
        const aligned = await api.align.unwarpFaceLandmarks(video, detections.landmarks);
        const res = await api.nets.faceRecognitionNet.extract(aligned);
        descriptor = res?.descriptor;
      }
      if (!descriptor) {
        return { ok: false, message: 'Face captured but could not be described. Try again.' };
      }
      return { ok: true, descriptor: Array.from(descriptor) };
    } catch (e) {
      return { ok: false, message: e?.message || 'Face capture failed' };
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  return (
    <FaceContext.Provider
      value={{
        ready,
        loading,
        loadError,
        videoRef,
        startCamera,
        captureDescriptor,
        stopStream,
        faceRegistered: !!user?.faceRegistered,
      }}
    >
      {children}
    </FaceContext.Provider>
  );
}

export function useFace() {
  return useContext(FaceContext);
}
