import React, { useState, useEffect } from 'react';
import CanvasHeader from './CanvasHeader';
import PreviewRenderer from './PreviewRenderer';
import CodeViewer from './CodeViewer';
import { downloadAsZip } from './CanvasUtils';


/**
 * Main Canvas Workspace Component
 * Orchestrates the rendering of different content types and manages the workspace state.
 */
const Canvas = ({ 
    isOpen, 
    onClose, 
    content, 
    type = 'text', 
    title = 'Canvas Workspace' 
}) => {
    const [animationState, setAnimationState] = useState('closed');
    const [activeTab, setActiveTab] = useState('preview');

    useEffect(() => {
        if (isOpen) {
            setAnimationState('opening');
            const timer = setTimeout(() => setAnimationState('open'), 10);
            return () => clearTimeout(timer);
        } else {
            setAnimationState('closing');
            const timer = setTimeout(() => {
                 if (!isOpen) setAnimationState('closed');
            }, 500); // Match CSS transition
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Reset tab when content changes
    useEffect(() => {
        if (type === 'frontend') {
            setActiveTab('preview');
        }
    }, [content, type]);

    if (!isOpen && animationState === 'closed') return null;

    const handleExportZip = () => {
        if (!content) return;
        const files = Array.isArray(content.files) ? content.files : [
            { name: content.language || 'index.html', code: content.code || content }
        ];
        downloadAsZip(files);
    };

    const renderMainContent = () => {
        if (!content) return <div className="canvas-empty">No content to display</div>;

        switch (type) {
            case 'frontend':
                return activeTab === 'preview' ? (
                    <PreviewRenderer content={content} />
                ) : (
                    <CodeViewer content={content} />
                );
            case 'code':
                return <CodeViewer content={content} />;
            case 'quiz':
                return (
                    <div className="canvas-quiz-container">
                        <h2>{content.title || 'Knowledge Check'}</h2>
                        <div className="quiz-questions">
                            {content.questions?.map((q, idx) => (
                                <div key={idx} className="quiz-item">
                                    <p className="question-text">{idx + 1}. {q.question}</p>
                                    <div className="quiz-options">
                                        {q.options?.map((opt, oIdx) => (
                                            <button key={oIdx} className="quiz-option">
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'text':
            default:
                return (
                    <div className="canvas-long-form">
                        <div className="canvas-markdown-body">
                            {content}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className={`canvas-container ${isOpen ? 'active' : ''} ${animationState} type-${type}`}>
            <CanvasHeader 
                title={title}
                onClose={onClose}
                type={type}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onExport={handleExportZip}
            />

            <main className="canvas-main-content">
                <div className={`canvas-inner-scroll ${type === 'frontend' ? 'full-width' : ''}`}>
                    {renderMainContent()}
                </div>
            </main>
        </div>
    );
};

export default Canvas;
