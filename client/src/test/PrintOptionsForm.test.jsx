import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrintOptionsForm } from '../components/student/PrintOptionsForm';

describe('PrintOptionsForm Component', () => {
  it('toggles color and duplex modes and invokes onChange callback', () => {
    const handleChange = vi.fn();
    const options = {
      color: false,
      duplex: false,
      copies: 1,
      paperSize: 'A4',
      binding: 'none'
    };

    render(<PrintOptionsForm options={options} onChange={handleChange} totalDocPages={5} />);

    // Click "Full Color" button
    const colorBtn = screen.getByText('Full Color');
    fireEvent.click(colorBtn);
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ color: true }));

    // Click "Double-Sided" button
    const duplexBtn = screen.getByText(/Double-Sided/i);
    fireEvent.click(duplexBtn);
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ duplex: true }));
  });

  it('selects binding options like Spiral, Staple, Punch', () => {
    const handleChange = vi.fn();
    const options = {
      color: false,
      duplex: false,
      copies: 1,
      binding: 'none'
    };

    render(<PrintOptionsForm options={options} onChange={handleChange} totalDocPages={10} />);

    const spiralBtn = screen.getByText('Spiral');
    fireEvent.click(spiralBtn);
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ binding: 'spiral' }));
  });
});
