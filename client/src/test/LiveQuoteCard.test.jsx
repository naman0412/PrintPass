import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveQuoteCard } from '../components/student/LiveQuoteCard';

describe('LiveQuoteCard Component', () => {
  it('renders locked price, estimated wait, and breakdown lines correctly', () => {
    const mockQuote = {
      totalPages: 10,
      baseCost: 20,
      duplexDiscount: 2.5,
      bindingCost: 30,
      total: 47.5
    };

    render(<LiveQuoteCard quote={mockQuote} estimatedWait={8} />);

    // Total price
    expect(screen.getByText('₹47.5')).toBeInTheDocument();

    // Estimated wait time
    expect(screen.getByText(/Ready in ~8 mins/i)).toBeInTheDocument();

    // Breakdown
    expect(screen.getByText(/Pages to print \(10 total\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Double-sided saving/i)).toBeInTheDocument();
    expect(screen.getByText(/- ₹2.5/i)).toBeInTheDocument();
    expect(screen.getByText(/\+ ₹30/i)).toBeInTheDocument();
  });

  it('renders loading placeholder state when loading=true', () => {
    const { container } = render(<LiveQuoteCard quote={null} estimatedWait={5} loading={true} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
