import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusTimeline } from '../components/student/StatusTimeline';

describe('StatusTimeline Component', () => {
  it('renders standard steps and marks active step correctly', () => {
    render(<StatusTimeline status="PRINTING" hasBinding={false} />);

    expect(screen.getByText('In Queue')).toBeInTheDocument();
    expect(screen.getByText('Printing')).toBeInTheDocument();
    expect(screen.getByText('Ready for Pickup')).toBeInTheDocument();
    expect(screen.getByText('Collected')).toBeInTheDocument();

    // Since hasBinding is false, FINISHING step should be omitted
    expect(screen.queryByText('Finishing')).not.toBeInTheDocument();
  });

  it('includes Finishing step when hasBinding is true', () => {
    render(<StatusTimeline status="FINISHING" hasBinding={true} />);

    expect(screen.getByText('Finishing')).toBeInTheDocument();
  });

  it('renders cancelled terminal state message when status=CANCELLED', () => {
    render(<StatusTimeline status="CANCELLED" hasBinding={false} />);

    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    expect(screen.getByText(/Job was cancelled before printing/i)).toBeInTheDocument();
  });
});
