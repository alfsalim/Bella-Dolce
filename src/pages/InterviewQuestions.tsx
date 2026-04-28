import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  Brain,
  Award,
  RefreshCw,
  Trophy
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Quelle est la température idéale pour cuire une Baguette Tradition ?",
    options: ["180°C - 200°C", "210°C - 230°C", "240°C - 260°C", "280°C - 300°C"],
    correctAnswer: 2,
    explanation: "Une température élevée de 240-260°C est nécessaire pour obtenir une croûte croustillante et une mie alvéolée."
  },
  {
    id: 2,
    text: "Qu'est-ce que le 'pointage' en boulangerie ?",
    options: [
      "Le moment où l'on pèse les pâtons",
      "La première fermentation de la pâte après le pétrissage",
      "L'action de grigner le pain avant l'enfournement",
      "La vérification de la température du four"
    ],
    correctAnswer: 1,
    explanation: "Le pointage est crucial pour le développement des arômes et de la structure de la pâte."
  },
  {
    id: 3,
    text: "Quel est le pourcentage d'humidité recommandé pour une étuve de fermentation ?",
    options: ["40-50%", "60-70%", "75-85%", "90-100%"],
    correctAnswer: 2,
    explanation: "Une humidité de 75-85% empêche le croûtage de la pâte pendant la fermentation."
  },
  {
    id: 4,
    text: "Pourquoi utilise-t-on de la buée lors de l'enfournement ?",
    options: [
      "Pour refroidir le pain",
      "Pour donner de la couleur à la mie",
      "Pour permettre le développement du pain et donner une croûte brillante",
      "Pour accélérer la cuisson"
    ],
    correctAnswer: 2,
    explanation: "La vapeur maintient la surface souple, permettant au pain de gonfler, et caramélise les sucres pour la brillance."
  }
];

const InterviewQuestions: React.FC = () => {
  const { t } = useLanguage();
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const handleAnswer = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    setIsAnswered(true);
    if (idx === QUESTIONS[currentQuestionIdx].correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIdx < QUESTIONS.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setShowResult(true);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestionIdx(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setShowResult(false);
  };

  const currentQuestion = QUESTIONS[currentQuestionIdx];

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 mb-4 border border-amber-500/20">
          <Brain className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-display font-bold text-slate-900 dark:text-white">Questions d'Entretien</h1>
        <p className="text-slate-500 dark:text-zinc-500 font-medium">Testez vos connaissances en boulangerie artisanale</p>
      </div>

      {!showResult ? (
        <div className="card border-slate-100 dark:border-white/10 shadow-xl dark:shadow-none overflow-hidden">
          <div className="h-2 bg-slate-100 dark:bg-white/5">
            <motion.div 
              className="h-full bg-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentQuestionIdx + 1) / QUESTIONS.length) * 100}%` }}
            />
          </div>

          <div className="p-8 md:p-12 space-y-8">
            <div className="space-y-4">
              <span className="text-amber-600 dark:text-amber-500 font-bold text-sm uppercase tracking-widest">
                Question {currentQuestionIdx + 1} sur {QUESTIONS.length}
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                {currentQuestion.text}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {currentQuestion.options.map((option, idx) => {
                const isCorrect = idx === currentQuestion.correctAnswer;
                const isSelected = idx === selectedOption;
                
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    disabled={isAnswered}
                    className={clsx(
                      "group p-6 rounded-2xl border-2 text-left transition-all duration-200 relative overflow-hidden",
                      !isAnswered && "border-slate-100 dark:border-white/5 hover:border-amber-500 hover:bg-amber-500/5",
                      isAnswered && isCorrect && "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-400",
                      isAnswered && !isCorrect && isSelected && "border-red-500 bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-400",
                      isAnswered && !isCorrect && !isSelected && "border-slate-100 dark:border-white/5 opacity-50"
                    )}
                  >
                    <div className="flex items-center justify-between relative z-10">
                      <span className="font-bold text-lg">{option}</span>
                      {isAnswered && isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                      {isAnswered && !isCorrect && isSelected && <XCircle className="w-6 h-6 text-red-500" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {isAnswered && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20"
                >
                  <div className="flex items-start gap-4">
                    <HelpCircle className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                    <div className="space-y-2">
                      <p className="font-bold text-amber-900 dark:text-amber-400">Explication</p>
                      <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                        {currentQuestion.explanation}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isAnswered && (
              <button 
                onClick={nextQuestion}
                className="w-full btn-primary py-4 text-lg gap-2 flex items-center justify-center group"
              >
                {currentQuestionIdx === QUESTIONS.length - 1 ? "Voir les résultats" : "Question suivante"}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-12 text-center space-y-8 border-slate-100 dark:border-white/10 shadow-2xl"
        >
          <div className="relative inline-block">
            <Trophy className="w-24 h-24 text-amber-500" />
            <motion.div 
              className="absolute -top-2 -right-2"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Award className="w-10 h-10 text-primary-500" />
            </motion.div>
          </div>

          <div className="space-y-2">
            <h2 className="text-4xl font-display font-bold text-slate-900 dark:text-white">Quiz Terminé !</h2>
            <p className="text-slate-500 dark:text-zinc-500 text-xl">
              Vous avez obtenu <span className="font-bold text-amber-600">{score} sur {QUESTIONS.length}</span> correct
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={resetQuiz}
              className="btn-primary py-4 px-8 gap-2 flex items-center justify-center"
            >
              <RefreshCw className="w-5 h-5" />
              Recommencer le Quiz
            </button>
            <button 
              className="px-8 py-4 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
              onClick={() => window.location.href = '/dashboard'}
            >
              Retour au tableau de bord
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default InterviewQuestions;
