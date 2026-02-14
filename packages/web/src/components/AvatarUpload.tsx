import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { useAuthStore } from '../stores/authStore';
import * as api from '../api';
import Avatar from './Avatar';

async function getCroppedBlob(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => { image.onload = resolve; });

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    256,
    256
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

export default function AvatarUpload() {
  const { user, setUser } = useAuthStore();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleUpload = async () => {
    if (!imageSrc || !croppedArea) return;
    setUploading(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      const result = await api.uploadAvatar(blob);
      setUser({ ...user!, avatar_url: result.avatar_url });
      setImageSrc(null);
    } catch (e) {
      console.error('Upload failed:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteAvatar();
      setUser({ ...user!, avatar_url: null });
    } catch (e) {
      console.error('Delete avatar failed:', e);
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <Avatar username={user.username} avatarUrl={user.avatar_url} size={64} />
        <div>
          <button
            onClick={() => fileRef.current?.click()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded font-medium"
          >
            Change Avatar
          </button>
          {user.avatar_url && (
            <button
              onClick={handleDelete}
              className="ml-2 text-red-400 hover:text-red-300 text-sm px-4 py-2 rounded font-medium bg-[#383a40] hover:bg-[#404249]"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onFileSelect}
        className="hidden"
      />

      {imageSrc && (
        <div className="mt-4">
          <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1"
            />
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded font-medium"
            >
              {uploading ? 'Uploading...' : 'Save'}
            </button>
            <button
              onClick={() => setImageSrc(null)}
              className="text-[#b5bac1] hover:text-white text-sm px-4 py-2 rounded font-medium bg-[#383a40] hover:bg-[#404249]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
