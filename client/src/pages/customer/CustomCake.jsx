import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../utils/useAsync';
import { Field } from '../../components/ui';
import ImageUpload from '../../components/ImageUpload';
import { useState } from 'react';

const OCCASIONS = ['Birthday', 'Wedding', 'Engagement', 'Anniversary', 'Baby Shower', 'Graduation', 'Corporate Event', 'Other'];
const FLAVORS = ['Butter', 'Chocolate', 'Vanilla', 'Red velvet', 'Ribbon', 'Coffee', 'Strawberry', 'Fruit cake'];
const SHAPES = ['Round', 'Square', 'Rectangle', 'Heart', 'Number / Letter', 'Custom shape'];
const ICING = ['Buttercream', 'Fondant', 'Fresh cream', 'Cream cheese', 'Ganache'];

// US13 - Customer provides cake requirements
export default function CustomCake() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [image, setImage] = useState(cart.cakeImage);
  const f = useForm(cart.customCake || {
    occasion: 'Birthday', flavor: 'Chocolate', weightKg: 1, shape: 'Round', tiers: 1, icingType: 'Buttercream',
    colors: '', theme: '', messageOnCake: '', dietaryNotes: '', additionalDetails: '',
  });

  const validate = (v) => ({
    occasion: v.occasion?.trim().length >= 2 ? undefined : 'Occasion is required',
    flavor: v.flavor?.trim().length >= 2 ? undefined : 'Flavour is required',
    weightKg: Number(v.weightKg) >= 0.5 && Number(v.weightKg) <= 20 ? undefined : 'Weight must be between 0.5 and 20 kg',
    shape: v.shape ? undefined : 'Shape is required',
    tiers: Number(v.tiers) >= 1 && Number(v.tiers) <= 5 ? undefined : 'Tiers must be between 1 and 5',
    messageOnCake: (v.messageOnCake || '').length <= 120 ? undefined : 'Message must be 120 characters or fewer',
  });

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const { design, estimate, ...rest } = v; // hand edits make the builder estimate stale
      cart.setCustomCake({ ...rest, weightKg: Number(v.weightKg), tiers: Number(v.tiers) }, image);
      toast.success('Custom cake added to your order');
      navigate('/cart');
    }, validate);
  };

  return (
    <div className="stack" style={{ maxWidth: 860, margin: '0 auto' }}>
      <div>
        <h1>Request a custom cake</h1>
        <p className="muted">Tell us what you have in mind. Our team will review your request and confirm the price before we start baking.</p>
      </div>
      <form className="card stack" onSubmit={onSubmit} noValidate>
        <h2>Cake details</h2>
        <div className="form-grid">
          <Field as="select" label="Occasion" required {...f.bind('occasion')}>{OCCASIONS.map((o) => <option key={o}>{o}</option>)}</Field>
          <Field label="Flavour" required list="flavors" {...f.bind('flavor')} hint="Choose or type your own" />
          <datalist id="flavors">{FLAVORS.map((o) => <option key={o} value={o} />)}</datalist>
          <Field label="Weight (kg)" type="number" min="0.5" max="20" step="0.5" required {...f.bind('weightKg')} />
          <Field as="select" label="Shape" required {...f.bind('shape')}>{SHAPES.map((o) => <option key={o}>{o}</option>)}</Field>
          <Field as="select" label="Tiers" {...f.bind('tiers')}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Field>
          <Field as="select" label="Icing" {...f.bind('icingType')}>{ICING.map((o) => <option key={o}>{o}</option>)}</Field>
        </div>
        <h2 className="mt-2">Design</h2>
        <div className="form-grid">
          <Field label="Colours" placeholder="e.g. Pastel pink and gold" maxLength={120} {...f.bind('colors')} />
          <Field label="Theme" placeholder="e.g. Unicorn, Floral, Football" maxLength={150} {...f.bind('theme')} />
          <Field className="full" label="Message on cake" maxLength={120} placeholder="e.g. Happy 5th Birthday Dinuk" hint={`${(f.values.messageOnCake || '').length}/120`} {...f.bind('messageOnCake')} />
          <Field className="full" label="Dietary requirements" maxLength={255} placeholder="e.g. Eggless, no nuts" {...f.bind('dietaryNotes')} />
          <Field className="full" as="textarea" label="Anything else we should know?" maxLength={1000} placeholder="Describe decorations, toppers, colours, serving size…" {...f.bind('additionalDetails')} />
          <div className="full">
            <ImageUpload label="Reference image (optional)" file={image} onChange={setImage} />
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn btn-primary">{cart.customCake ? 'Update cake request' : 'Add to order'}</button>
        </div>
      </form>
    </div>
  );
}
