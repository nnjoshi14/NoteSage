import React, { useState, useEffect } from 'react';
import { Person } from '../../stores/slices/peopleSlice';
import './PersonForm.css';

interface PersonFormProps {
  person?: Person | null;
  onSave: (personData: Partial<Person>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  linkedin_url: string;
  avatar_url: string;
  notes: string;
}

const PersonForm: React.FC<PersonFormProps> = ({
  person,
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    linkedin_url: '',
    avatar_url: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (person) {
      setFormData({
        name: person.name || '',
        email: person.email || '',
        phone: person.phone || '',
        company: person.company || '',
        title: person.title || '',
        linkedin_url: person.linkedin_url || '',
        avatar_url: person.avatar_url || '',
        notes: person.notes || '',
      });
    }
  }, [person]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setIsDirty(true);

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    // Name is required
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Email validation (if provided)
    if (formData.email && !isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone validation (if provided)
    if (formData.phone && !isValidPhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // LinkedIn URL validation (if provided)
    if (formData.linkedin_url && !isValidLinkedInUrl(formData.linkedin_url)) {
      newErrors.linkedin_url = 'Please enter a valid LinkedIn URL';
    }

    // Avatar URL validation (if provided)
    if (formData.avatar_url && !isValidUrl(formData.avatar_url)) {
      newErrors.avatar_url = 'Please enter a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidPhone = (phone: string): boolean => {
    // Basic phone validation - allows various formats
    const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
    const cleanPhone = phone.replace(/[\s\-().]/g, '');
    return phoneRegex.test(cleanPhone);
  };

  const isValidLinkedInUrl = (url: string): boolean => {
    const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/;
    return linkedinRegex.test(url);
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Clean up the data before saving
    const cleanedData: Partial<Person> = {};
    
    Object.entries(formData).forEach(([key, value]) => {
      if (value && value.trim()) {
        cleanedData[key as keyof Person] = value.trim();
      }
    });

    onSave(cleanedData);
  };

  const handleCancel = () => {
    if (isDirty && !confirm('You have unsaved changes. Are you sure you want to cancel?')) {
      return;
    }
    onCancel();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  return (
    <div className="person-form-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{person ? 'Edit Person' : 'Add New Person'}</h3>
          <button className="close-btn" onClick={handleCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="person-form">
          <div className="modal-body">
            {/* Avatar section */}
            <div className="form-section">
              <div className="avatar-section">
                <div className="avatar-preview">
                  {formData.avatar_url ? (
                    <img 
                      src={formData.avatar_url} 
                      alt="Avatar preview"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling!.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="avatar-initials"
                    style={{ display: formData.avatar_url ? 'none' : 'flex' }}
                  >
                    {formData.name ? getInitials(formData.name) : '?'}
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Avatar URL</label>
                  <input
                    type="url"
                    className={`form-control ${errors.avatar_url ? 'is-invalid' : ''}`}
                    placeholder="https://example.com/avatar.jpg"
                    value={formData.avatar_url}
                    onChange={(e) => handleInputChange('avatar_url', e.target.value)}
                  />
                  {errors.avatar_url && (
                    <div className="invalid-feedback">{errors.avatar_url}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Basic information */}
            <div className="form-section">
              <h4>Basic Information</h4>
              
              <div className="form-group">
                <label className="form-label required">Name</label>
                <input
                  type="text"
                  className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
                {errors.name && (
                  <div className="invalid-feedback">{errors.name}</div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                  {errors.email && (
                    <div className="invalid-feedback">{errors.email}</div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    className={`form-control ${errors.phone ? 'is-invalid' : ''}`}
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                  {errors.phone && (
                    <div className="invalid-feedback">{errors.phone}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Professional information */}
            <div className="form-section">
              <h4>Professional Information</h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Company</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Company name"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Job title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">LinkedIn URL</label>
                <input
                  type="url"
                  className={`form-control ${errors.linkedin_url ? 'is-invalid' : ''}`}
                  placeholder="https://linkedin.com/in/username"
                  value={formData.linkedin_url}
                  onChange={(e) => handleInputChange('linkedin_url', e.target.value)}
                />
                {errors.linkedin_url && (
                  <div className="invalid-feedback">{errors.linkedin_url}</div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="form-section">
              <h4>Notes</h4>
              
              <div className="form-group">
                <label className="form-label">Additional Notes</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Any additional information about this person..."
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading || !formData.name.trim()}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  {person ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                person ? 'Update Person' : 'Create Person'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PersonForm;