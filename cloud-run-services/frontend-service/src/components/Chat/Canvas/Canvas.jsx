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
    title = 'Canvas Workspace',
    onSendMessage
}) => {
    const [animationState, setAnimationState] = useState('closed');
    const [activeTab, setActiveTab] = useState('preview');
    const [quizAnswers, setQuizAnswers] = useState({}); // Stores answers for each question index
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    const [isExpanded, setIsExpanded] = useState(false);

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

    // Reset tab, quiz state, and expansion when content changes
    useEffect(() => {
        if (type === 'frontend') {
            setActiveTab('preview');
        } else if (type === 'quiz') {
            setQuizAnswers({});
            setCurrentQuestionIndex(0);
        }
    }, [content, type]);

    // Close expansion if canvas is closed
    useEffect(() => {
        if (!isOpen) {
            setIsExpanded(false);
        }
    }, [isOpen]);

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
                 const totalQuestions = content.questions?.length || 0;
                const isCompleted = currentQuestionIndex >= totalQuestions;
                
                let score = 0;
                if (isCompleted) {
                    content.questions.forEach((q, idx) => {
                        if (quizAnswers[idx] === q.answer) score++;
                    });
                }

                return (
                    <div className="canvas-quiz-container">
                        {!isCompleted && (
                            <div className="quiz-progress-bar-container">
                                <div 
                                    className="quiz-progress-bar" 
                                    style={{ width: `${((currentQuestionIndex) / totalQuestions) * 100}%` }}
                                ></div>
                            </div>
                        )}
                        
                        {!isCompleted && (
                            <div className="quiz-progress-pill top-offset">
                                Question {currentQuestionIndex + 1} of {totalQuestions}
                            </div>
                        )}

                        {!isCompleted ? (
                            <div className="quiz-question-view">
                                {content.questions?.map((q, idx) => {
                                    if (idx !== currentQuestionIndex) return null;
                                    
                                    const selectedAnswer = quizAnswers[idx];
                                    const isCorrect = selectedAnswer === q.answer;
                                    
                                    return (
                                        <div key={idx} className="quiz-item single-view active">
                                            <p className="question-text">{q.question}</p>
                                            <div className="quiz-options">
                                                {q.options?.map((opt, oIdx) => {
                                                    let btnClass = 'quiz-option';
                                                    if (selectedAnswer === opt) {
                                                        btnClass += opt === q.answer ? ' correct' : ' incorrect';
                                                    } else if (selectedAnswer !== undefined && opt === q.answer) {
                                                        btnClass += ' correct-hint';
                                                    }

                                                    return (
                                                        <button 
                                                            key={oIdx} 
                                                            className={btnClass}
                                                            disabled={selectedAnswer !== undefined}
                                                            onClick={() => {
                                                                setQuizAnswers(prev => ({ ...prev, [idx]: opt }));
                                                            }}
                                                        >
                                                            <span className="option-letter-pill">{String.fromCharCode(65 + oIdx)}</span>
                                                            <span className="option-text">{opt}</span>
                                                            {selectedAnswer === opt && (
                                                                <i className={`bx ${opt === q.answer ? 'bx-check-circle' : 'bx-x-circle'}`}></i>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {selectedAnswer !== undefined && q.explanation && (
                                                <div className={`quiz-explanation ${isCorrect ? 'correct' : 'incorrect'}`}>
                                                    <div className="explanation-header">
                                                        <i className={isCorrect ? 'bx bx-check-double' : 'bx bx-info-circle'}></i>
                                                        <strong>{isCorrect ? 'Correct!' : 'Incorrect.'}</strong>
                                                    </div>
                                                    <p>{q.explanation}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <div className="quiz-navigation">
                                    <div className="nav-group">
                                        <button 
                                            className="nav-btn prev" 
                                            disabled={currentQuestionIndex === 0}
                                            onClick={() => setCurrentQuestionIndex(p => p - 1)}
                                        >
                                            <i className='bx bx-chevron-left'></i>
                                            <span className="nav-text">Previous</span>
                                        </button>
                                        
                                        {quizAnswers[currentQuestionIndex] === undefined && (
                                            <button 
                                                className="nav-btn skip"
                                                onClick={() => setCurrentQuestionIndex(p => p + 1)}
                                            >
                                                <span className="nav-text">Skip</span>
                                                <i className='bx bx-fast-forward'></i>
                                            </button>
                                        )}
                                    </div>
                                    
                                    <button 
                                        className="nav-btn next premium"
                                        disabled={quizAnswers[currentQuestionIndex] === undefined && currentQuestionIndex < totalQuestions}
                                        onClick={() => setCurrentQuestionIndex(p => p + 1)}
                                    >
                                        <span className="nav-text">{currentQuestionIndex === totalQuestions - 1 ? 'Finish' : 'Next'}</span>
                                        <i className='bx bx-chevron-right'></i>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="quiz-completion-card">
                                <div className="completion-icon">🎉</div>
                                <h3>Quiz Completed!</h3>
                                <div className="quiz-score-display">
                                    <span className="score-number">{score}/{totalQuestions}</span>
                                    <span className="score-text">
                                        {score === totalQuestions ? "Perfect Score! Master class! 🌟" : 
                                         score >= totalQuestions / 2 ? "Great job! Keep it up!" : 
                                         "Good effort! Review the explanations to learn more."}
                                    </span>
                                </div>
                                
                                {onSendMessage && (
                                    <div className="quiz-suggestions">
                                        <p>Continue your progress:</p>
                                        <div className="suggestion-buttons">
                                            <button onClick={() => { onClose(); onSendMessage(`Generate 5 more questions on this topic.`); }}>
                                                <i className='bx bx-plus'></i> +5 Questions
                                            </button>
                                            <button onClick={() => { onClose(); onSendMessage(`Generate 10 more questions on this topic.`); }}>
                                                <i className='bx bx-list-plus'></i> +10 Questions
                                            </button>
                                            <button onClick={() => { onClose(); onSendMessage(`Generate 15 more questions on this topic.`); }}>
                                                <i className='bx bx-grid-alt'></i> +15 Questions
                                            </button>
                                            <button onClick={() => { onClose(); onSendMessage(`Increase Difficulty: Generate harder questions.`); }}>
                                                <i className='bx bx-trending-up'></i> Hard Mode
                                            </button>
                                            <button onClick={() => { onClose(); onSendMessage(`Review Basics: Generate easier questions.`); }}>
                                                <i className='bx bx-brain'></i> Review Basics
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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
        <div className={`canvas-container ${isOpen ? 'active' : ''} ${animationState} type-${type} ${isExpanded ? 'expanded' : ''}`}>
            <CanvasHeader 
                title={title}
                onClose={onClose}
                onToggleExpand={() => setIsExpanded(!isExpanded)}
                isExpanded={isExpanded}
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
