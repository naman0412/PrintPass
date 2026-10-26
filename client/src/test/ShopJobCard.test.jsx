import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShopJobCard } from '../components/shop/ShopJobCard';

describe('ShopJobCard Component', () => {
  it('renders badges, file info, and action buttons in plain words', () => {
    const handleUpdateStatus = vi.fn();
    const handleVerifyClick = vi.fn();

    const mockJob = {
      _id: 'job_123',
      originalFilename: 'assignment.pdf',
      pageCount: 15,
      status: 'QUEUED',
      slotStart: '2026-10-26T14:30:00.000Z',
      options: {
        color: true,
        colorPageRanges: '1-3',
        duplex: true,
        copies: 2,
        binding: 'spiral',
        paperSize: 'A4'
      }
    };

    render(
      <ShopJobCard
        job={mockJob}
        onUpdateStatus={handleUpdateStatus}
        onVerifyClick={handleVerifyClick}
      />
    );

    // Badges
    expect(screen.getByText(/COLOR \(1-3\)/i)).toBeInTheDocument();
    expect(screen.getByText('DUPLEX')).toBeInTheDocument();
    expect(screen.getByText('SPIRAL BINDING')).toBeInTheDocument();

    // Document Name and Page info
    expect(screen.getByText('assignment.pdf')).toBeInTheDocument();
    expect(screen.getByText(/15 pages • 2 copies/i)).toBeInTheDocument();

    // "Send to Print" button for QUEUED status
    const printBtn = screen.getByText('Send to Print');
    expect(printBtn).toBeInTheDocument();

    fireEvent.click(printBtn);
    expect(handleUpdateStatus).toHaveBeenCalledWith('job_123', 'PRINTING');
  });

  it('renders "Verify & Hand Over" action button when job is READY', () => {
    const handleUpdateStatus = vi.fn();
    const handleVerifyClick = vi.fn();

    const mockJob = {
      _id: 'job_456',
      originalFilename: 'thesis.pdf',
      pageCount: 50,
      status: 'READY',
      pickupCode: '9X2K7L',
      options: {
        color: false,
        duplex: true,
        binding: 'none'
      }
    };

    render(
      <ShopJobCard
        job={mockJob}
        onUpdateStatus={handleUpdateStatus}
        onVerifyClick={handleVerifyClick}
      />
    );

    const verifyBtn = screen.getByText('Verify & Hand Over');
    expect(verifyBtn).toBeInTheDocument();

    fireEvent.click(verifyBtn);
    expect(handleVerifyClick).toHaveBeenCalledWith(mockJob);
  });
});
