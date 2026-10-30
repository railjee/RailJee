'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { API_ENDPOINTS } from '@/lib/apiConfig';
import { ExamMode } from '@/lib/examTypes';
import { getExamAttemptCount, getBestScore } from '@/lib/examStorage';
import { useExamTimer, useExamData, useExamState, useExamSubmission } from '@/hooks';
import { useNavigation } from '@/components/NavigationProvider';
import { createClient, getSupabaseAccessToken } from '@/lib/supabase/client';
import { emitExternalApiError } from '@/lib/externalApiError';
import { trackViewContent } from '@/lib/metaTracking';
import LoadingScreen from './LoadingScreen';
import ErrorScreen from './common/ErrorScreen';
import ExamInstructions from './exam/ExamInstructions';
import ExamQuestion from './exam/ExamQuestion';
import QuestionPalette from './exam/QuestionPalette';
import SubmitConfirmation from './exam/SubmitConfirmation';
import ExamHeader from './exam/ExamHeader';
import ExamActionBar from './exam/ExamActionBar';

const PENDING_SUBMISSION_KEY = 'pending_exam_submission';

interface PendingSubmission {
  examId: string;
  activeExamId: string;
  paperId: string;
  departmentId: string;
  answers: (number | null)[];
  markedForReview: boolean[];
  timeRemaining: number;
  questionIds: number[];
  totalQuestions: number;
}

interface ExamPageClientProps {
  examId: string;
}

export default function ExamPageClient({ examId }: ExamPageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { navigate } = useNavigation();
  const deptSlugFromUrl = searchParams.get('dept');

  // Core state
  const [hasStarted, setHasStarted] = useState(false);
  const [examMode, setExamMode] = useState<ExamMode | null>(null);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Map<number, number>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Ref to allow navigation during submission without triggering beforeunload warning
  const isSubmittingRef = useRef(false);

  // Refs so the beforeunload/popstate closure always reads the latest values
  // without those values being in the effect dependency array (which would
  // cause pushState to fire on every timer tick — flooding browser history).
  const timeRemainingRef = useRef(0);
  const answersRef = useRef<(number | null)[]>([]);
  const markedForReviewRef = useRef<boolean[]>([]);

  // Fetch exam data
  const {
    exam,
    questions,
    loading,
    error,
    questionsLoading,
    questionsPrefetched,
    loadQuestions,
    fetchPracticeAnswers
  } = useExamData({ examId, deptSlug: deptSlugFromUrl });

  // Exam state management
  const examState = useExamState({ totalQuestions: questions.length });

  // Timer
  const timer = useExamTimer({
    initialTime: exam ? exam.duration * 60 : 0,
    isActive: hasStarted,
    onTimeUp: handleSubmit
  });

  // Submission
  const submission = useExamSubmission({
    initialTime: exam ? exam.duration * 60 : 0,
    markingScheme: {
      correct: 1,
      incorrect: -1/3,
      unattempted: 0
    }
  });

  // Keep userId in sync with auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Meta ViewContent: once per paper, when its details have loaded
  const viewContentTrackedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!exam?.paperId || viewContentTrackedFor.current === exam.paperId) return;
    viewContentTrackedFor.current = exam.paperId;
    trackViewContent({
      contentIds: [exam.paperId],
      contentCategory: deptSlugFromUrl || exam.departmentId,
      contentName: exam.name,
    });
  }, [exam, deptSlugFromUrl]);

  // Scroll to top when question changes
  useEffect(() => {
    if (hasStarted) {
      window.scrollTo(0, 0);
    }
  }, [examState.currentIndex, hasStarted]);

  // Check for pending submission on mount (after reload)
  useEffect(() => {
    const pendingRaw = sessionStorage.getItem(PENDING_SUBMISSION_KEY);
    if (!pendingRaw) return;

    try {
      const pending: PendingSubmission = JSON.parse(pendingRaw);

      // Only process if it matches the current exam
      if (pending.examId !== examId) return;

      // Remove immediately to prevent re-processing once we're ready to submit
      sessionStorage.removeItem(PENDING_SUBMISSION_KEY);

      // Auto-submit the exam
      setIsSubmitting(true);

      const attempted = pending.answers.filter((a) => a !== null).length;
      const unattempted = pending.totalQuestions - attempted;

      const responses = pending.questionIds.map((qId, index) => ({
        questionId: qId,
        selectedOption: pending.answers[index] !== null ? pending.answers[index]! : -1,
        isFlagged: pending.markedForReview[index] || false,
      }));

      getSupabaseAccessToken().then(accessToken => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }
        
        return fetch(API_ENDPOINTS.SUBMIT_EXAM, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            examId: pending.activeExamId,
            paperId: pending.paperId,
            departmentId: pending.departmentId,
            attemptedQuestions: attempted,
            unattemptedQuestions: unattempted,
            responses,
          }),
        });
      })
        .then((res) => {
          if (!res.ok) throw new Error('Submit failed');
          return res.json();
        })
        .then((data) => {
          if (data.success && data.data?.examId) {
            isSubmittingRef.current = true;
            navigate(`/exam/result/${data.data.examId}`);
          } else {
            throw new Error('Invalid submit response');
          }
        })
        .catch((err) => {
          console.error('Error auto-submitting exam after reload:', err);
          setIsSubmitting(false);
          emitExternalApiError();
        });
    } catch (err) {
      console.error('Error parsing pending submission:', err);
      sessionStorage.removeItem(PENDING_SUBMISSION_KEY);
    }
  }, [examId, userId, navigate]);

  // Keep refs in sync with the latest volatile values (no re-renders, no effect deps)
  useEffect(() => { timeRemainingRef.current = timer.timeRemaining; }, [timer.timeRemaining]);
  useEffect(() => { answersRef.current = examState.answers; }, [examState.answers]);
  useEffect(() => { markedForReviewRef.current = examState.markedForReview; }, [examState.markedForReview]);

  // Prevent accidental navigation during exam.
  // IMPORTANT: this effect must NOT depend on timer.timeRemaining, examState.answers,
  // or examState.markedForReview — those change constantly and would cause
  // window.history.pushState to be called on every tick, flooding the browser
  // history and breaking post-submit navigation back to the result page.
  useEffect(() => {
    if (!hasStarted) return;

    const handlePopState = (e: PopStateEvent) => {
      // Don't intercept navigation that is part of a deliberate exam submission.
      if (isSubmittingRef.current) return;
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      setShowSubmitConfirm(true);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Allow navigation if exam is being submitted
      if (isSubmittingRef.current) {
        return;
      }

      // Save current exam state so it can be submitted after reload
      if (exam && activeExamId && questions.length > 0 && exam.paperId && exam.departmentId) {
        const pendingData: PendingSubmission = {
          examId,
          activeExamId,
          paperId: exam.paperId,
          departmentId: exam.isGeneral ? 'general' : exam.departmentId,
          answers: answersRef.current,
          markedForReview: markedForReviewRef.current,
          timeRemaining: timeRemainingRef.current,
          questionIds: questions.map((q) => q.id),
          totalQuestions: questions.length,
        };
        sessionStorage.setItem(
          PENDING_SUBMISSION_KEY,
          JSON.stringify(pendingData)
        );
      }

      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, exam, activeExamId, questions, examId]);

  // Handlers
  async function handleStartExam(mode: ExamMode) {
    setExamMode(mode);
    setIsStarting(true);
    
    try {
      let examQuestions = questions;
      if (questions.length === 0) {
        examQuestions = await loadQuestions();
      }
      
      if (!examQuestions || examQuestions.length === 0) {
        throw new Error('No questions available');
      }
      
      // Initialize exam with loaded questions
      examState.initializeExam(examQuestions.length);
      setHasStarted(true);
      
      // Track exam start in background (non-blocking)
      if (exam?.paperId && exam?.departmentId && userId) {
       getSupabaseAccessToken().then(accessToken => {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
          }
          
          return fetch(API_ENDPOINTS.START_EXAM, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              paperId: exam.paperId,
              departmentId: exam.isGeneral ? 'general' : exam.departmentId,
              examMode:mode,
            }),
          });
        }).then(response => {
          if (response && response.ok) {
            return response.json();
          }
        }).then(startData => {
          if (startData?.success && startData.data?.examId) {
            setActiveExamId(startData.data.examId);
          }
        }).catch(err => {
          console.error('Error tracking exam start:', err);
        });
      } else if (exam?.paperId && exam?.departmentId && !userId) {
        console.warn('Skipping exam start tracking due to missing user id.');
      }
      
      // Fetch practice answers in background if needed
      if (mode === 'mock') {
        fetchPracticeAnswers().then(answers => {
          if (answers) {
            setPracticeAnswers(answers);
          }
        }).catch(err => {
          console.error('Error fetching practice answers:', err);
        });
      }
    } catch (err) {
      console.error('Error starting exam:', err);
      emitExternalApiError();
    } finally {
      setIsStarting(false);
    }
  }

  async function handleSubmit() {
    examState.saveCurrentAnswer();
    
    const result = submission.calculateResult(
      questions,
      examState.answers,
      timer.timeRemaining
    );

    // Submit to API
    if (exam && activeExamId) {
      try {
        if (!userId) {
          alert('Please sign in to submit your exam.');
          setShowSubmitConfirm(false);
          return;
        }

        setIsSubmitting(true); // Set loading state
        
        const responses = questions.map((question, index) => ({
          questionId: question.id,
          selectedOption: examState.answers[index] !== null ? examState.answers[index]! : -1,
          isFlagged: examState.markedForReview[index] || false
        }));
        
        const accessToken = await getSupabaseAccessToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }
        
        const submitResponse = await fetch(API_ENDPOINTS.SUBMIT_EXAM, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            examId: activeExamId,
            paperId: exam.paperId,
            departmentId: exam.isGeneral ? 'general' : exam.departmentId,
            attemptedQuestions: result.totalQuestions - result.skippedQuestions,
            unattemptedQuestions: result.skippedQuestions,
            responses
          }),
        });

        if (submitResponse.ok) {
          const submitData = await submitResponse.json();
          if (submitData.success && submitData.data?.examId) {
            // Set flag to allow navigation without warning
            isSubmittingRef.current = true;
            
            // Close the overlay immediately so the train loading screen
            // from NavigationProvider takes over while the result page loads.
            setShowSubmitConfirm(false);
            setIsSubmitting(false);
            navigate(`/exam/result/${submitData.data.examId}`);
            return;
          }
        }
        
        // If we reach here, submission failed
        throw new Error('Failed to submit exam');
      } catch (err) {
        console.error('Error submitting exam:', err);
        setIsSubmitting(false); // Reset loading state on error
        emitExternalApiError();
        setShowSubmitConfirm(false);
        return;
      }
    }

    // If exam or activeExamId is missing, show error
    setIsSubmitting(false); // Reset loading state
    emitExternalApiError();
    setShowSubmitConfirm(false);
  }

  function handleSelectAnswer(optionIndex: number) {
    examState.selectAnswer(optionIndex, examMode === 'mock');
  }

  function handleNextQuestion() {
    const moved = examState.goToNextQuestion();
    if (!moved) {
      // On last question, show submit confirmation
      setShowSubmitConfirm(true);
    }
  }

  function handlePreviousQuestion() {
    examState.goToPreviousQuestion();
  }

  function handleQuestionJump(index: number) {
    examState.goToQuestion(index);
    setShowMobilePalette(false);
  }

  // Render states
  if (isSubmitting && !hasStarted) {
    // Auto-submitting after reload
    return <LoadingScreen
      isLoading={true}
      message="Submitting your exam..."
      animationPath="/animation/Trainbasic.lottie/a/Scene.json"
    />;
  }

  if (loading) {
    return <LoadingScreen 
      isLoading={true} 
      message="Loading exam details..." 
      animationPath="/animation/Trainbasic.lottie/a/Scene.json"
    />;
  }

  if (error) {
    return <div className="min-h-screen bg-[#faf9f7]" />;
  }

  if (!exam) {
    return (
      <ErrorScreen
        title="Exam not found"
        message="The exam you're looking for doesn't exist."
        onRetry={undefined}
      />
    );
  }

  // Pre-exam instructions
  if (!hasStarted) {
    const attemptCount = getExamAttemptCount(examId);
    const bestScore = attemptCount > 0 ? getBestScore(examId) : null;

    return (
      <ExamInstructions
        exam={exam}
        questionsLoading={questionsLoading}
        questionsPrefetched={questionsPrefetched}
        attemptCount={attemptCount}
        bestScore={bestScore}
        onStartExam={handleStartExam}
        isStarting={isStarting}
      />
    );
  }

  // Active exam
  const currentQuestion = questions[examState.currentIndex];
  const isPracticeMode = examMode === 'mock';
  const isLocked = isPracticeMode && examState.lockedQuestions[examState.currentIndex];
  const correctAnswer = isPracticeMode && isLocked ? practiceAnswers.get(currentQuestion.id) : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-orange-50/30 to-stone-100 flex flex-col">
      {/* Header */}
      <ExamHeader
        examName={exam.name}
        currentQuestionIndex={examState.currentIndex}
        totalQuestions={exam.totalQuestions}
        timeRemaining={timer.timeRemaining}
        answeredCount={examState.answeredCount}
        onShowPalette={() => setShowMobilePalette(true)}
        onSubmit={() => setShowSubmitConfirm(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-5xl p-3 sm:p-4 lg:p-6">
          <div className="w-full">
            {/* Question */}
            <div className="mb-3 sm:mb-4">
              <ExamQuestion
                question={currentQuestion}
                questionIndex={examState.currentIndex}
                totalQuestions={exam.totalQuestions}
                selectedAnswer={examState.selectedAnswer}
                onSelectAnswer={handleSelectAnswer}
                markedForReview={examState.markedForReview[examState.currentIndex]}
                onToggleMarkForReview={examState.toggleMarkForReview}
                onSubmit={() => setShowSubmitConfirm(true)}
                showSubmitButton={true}
                practiceMode={isPracticeMode}
                isLocked={isLocked}
                correctAnswer={correctAnswer}
              />
            </div>

            {/* Navigation */}
            <ExamActionBar
              currentQuestionIndex={examState.currentIndex}
              totalQuestions={exam.totalQuestions}
              onPrevious={handlePreviousQuestion}
              onNext={handleNextQuestion}
              onSubmit={() => setShowSubmitConfirm(true)}
            />
          </div>
        </div>
      </div>

      {/* Submit Confirmation */}
      {showSubmitConfirm && (
        <SubmitConfirmation
          totalQuestions={exam.totalQuestions}
          answeredCount={examState.answeredCount}
          skippedCount={examState.skippedCount}
          markedCount={examState.markedCount}
          answers={examState.answers}
          markedForReview={examState.markedForReview}
          visitedQuestions={examState.visitedQuestions}
          onSubmit={handleSubmit}
          onCancel={() => setShowSubmitConfirm(false)}
          onQuestionJump={handleQuestionJump}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Question Palette */}
      <QuestionPalette
        totalQuestions={exam.totalQuestions}
        currentQuestionIndex={examState.currentIndex}
        answers={examState.answers}
        markedForReview={examState.markedForReview}
        visitedQuestions={examState.visitedQuestions}
        onQuestionJump={handleQuestionJump}
        showMobile={showMobilePalette}
        onCloseMobile={() => setShowMobilePalette(false)}
      />
    </div>
  );
}
