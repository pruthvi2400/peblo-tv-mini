// eslint-disable-next-line react/react-in-jsx-scope
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ImageWithFallback } from '../components/ImageWithFallback';

describe('ImageWithFallback', () => {
  it('renders with null src', () => {
    render(<ImageWithFallback src={null} alt="test" />);
    expect(screen.getByTestId('image-fallback')).toBeInTheDocument();
  });

  it('renders with valid src', () => {
    render(<ImageWithFallback src="http://example.com/image.jpg" alt="test" />);
    expect(screen.getByTestId('image-wrapper')).toBeInTheDocument();
  });
});
