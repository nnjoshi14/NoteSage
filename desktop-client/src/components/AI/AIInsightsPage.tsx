import React, { useEffect } from 'react';
import { useAppDispatch } from '@/stores/hooks';
import { initializeAI } from '@/stores/slices/aiSlice';
import AIInsights from './AIInsights';
import './AIInsightsPage.css';

const AIInsightsPage: React.FC = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Initialize AI when the insights page loads
    dispatch(initializeAI());
  }, [dispatch]);

  return (
    <div className="ai-insights-page">
      <div className="page-header">
        <h1>AI Insights</h1>
        <p className="page-description">
          Discover patterns, connections, and suggestions from your knowledge base using AI analysis.
        </p>
      </div>
      
      <AIInsights />
    </div>
  );
};

export default AIInsightsPage;