import { useEffect, useState } from 'react';

const MAX = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Image picker with preview and client-side type/size checks (mirrors the API limits). */
export default function ImageUpload({ label = 'Image', currentUrl, file, onChange, error, onRemoveCurrent }) {
  const [preview, setPreview] = useState(null);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!TYPES.includes(f.type)) { setLocalError('Only JPG, PNG or WEBP images are allowed'); return; }
    if (f.size > MAX) { setLocalError('Image must be 2 MB or smaller'); return; }
    setLocalError('');
    onChange(f);
  };

  const shown = preview || currentUrl;
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="image-upload">
        {shown ? <img src={shown} alt="Preview" className="preview" /> : <div className="preview">No image</div>}
        <div className="stack-sm">
          <label className="btn btn-secondary btn-sm">
            {shown ? 'Change image' : 'Upload image'}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} hidden />
          </label>
          {file && <button type="button" className="link-btn text-sm" onClick={() => onChange(null)}>Remove selected</button>}
          {!file && currentUrl && onRemoveCurrent && <button type="button" className="link-btn text-sm" onClick={onRemoveCurrent}>Remove image</button>}
          <div className="field-hint">JPG, PNG or WEBP, up to 2 MB</div>
        </div>
      </div>
      {(localError || error) && <span className="field-error">{localError || error}</span>}
    </div>
  );
}
