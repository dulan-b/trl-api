import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';
import type { SubmitQuizRequest } from '@trl/shared';

interface CreateQuizRequest {
  lessonId: string;
  passingScore: number;
  maxAttempts: number;
  questions: {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }[];
}

/**
 * Create a quiz for a lesson
 */
export async function createQuiz(
  request: FastifyRequest<{
    Body: CreateQuizRequest;
  }>,
  reply: FastifyReply
) {
  const { lessonId, passingScore, maxAttempts, questions } = request.body;

  try {
    // Check if lesson exists and is a quiz type
    const [lesson] = await sql`
      SELECT * FROM lessons WHERE id = ${lessonId}
    `;

    if (!lesson) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Lesson not found',
      });
    }

    if (lesson.lesson_type !== 'quiz') {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Lesson must be of type quiz',
      });
    }

    // Check if quiz already exists for this lesson
    const [existingQuiz] = await sql`
      SELECT * FROM quizzes WHERE lesson_id = ${lessonId}
    `;

    if (existingQuiz) {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'Quiz already exists for this lesson',
      });
    }

    // Create quiz
    const [quiz] = await sql`
      INSERT INTO quizzes (
        lesson_id,
        passing_score,
        max_attempts,
        questions
      )
      VALUES (
        ${lessonId},
        ${passingScore},
        ${maxAttempts},
        ${JSON.stringify(questions)}
      )
      RETURNING *
    `;

    request.log.info({ quizId: quiz.id, lessonId }, 'Quiz created');

    return reply.code(201).send({
      id: quiz.id,
      lessonId: quiz.lesson_id,
      passingScore: quiz.passing_score,
      maxAttempts: quiz.max_attempts,
      questionCount: questions.length,
      createdAt: quiz.created_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to create quiz');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create quiz',
    });
  }
}

/**
 * Get quiz by lesson ID
 */
export async function getQuizByLessonId(
  request: FastifyRequest<{
    Params: { lessonId: string };
  }>,
  reply: FastifyReply
) {
  const { lessonId } = request.params;

  try {
    const [quiz] = await sql`
      SELECT * FROM quizzes WHERE lesson_id = ${lessonId}
    `;

    if (!quiz) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Quiz not found for this lesson',
      });
    }

    // Parse questions and remove correct answers for students
    const questions = JSON.parse(quiz.questions as string);
    const sanitizedQuestions = questions.map(
      (q: any, index: number) => ({
        index,
        question: q.question,
        options: q.options,
        // Don't send correct answer or explanation until after submission
      })
    );

    return reply.send({
      id: quiz.id,
      lessonId: quiz.lesson_id,
      passingScore: quiz.passing_score,
      maxAttempts: quiz.max_attempts,
      questions: sanitizedQuestions,
      createdAt: quiz.created_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to get quiz');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve quiz',
    });
  }
}

/**
 * Submit quiz answers
 */
export async function submitQuizAnswers(
  request: FastifyRequest<{
    Params: { quizId: string };
    Body: SubmitQuizRequest & { studentId: string; enrollmentId: string };
  }>,
  reply: FastifyReply
) {
  const { quizId } = request.params;
  const { studentId, enrollmentId, answers } = request.body;

  try {
    // Get quiz
    const [quiz] = await sql`
      SELECT * FROM quizzes WHERE id = ${quizId}
    `;

    if (!quiz) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Quiz not found',
      });
    }

    // Check enrollment exists
    const [enrollment] = await sql`
      SELECT * FROM enrollments
      WHERE id = ${enrollmentId} AND student_id = ${studentId}
    `;

    if (!enrollment) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Enrollment not found',
      });
    }

    // Count previous attempts
    const previousAttempts = await sql`
      SELECT COUNT(*) as count FROM quiz_attempts
      WHERE quiz_id = ${quizId} AND student_id = ${studentId}
    `;

    const attemptNumber = previousAttempts[0].count + 1;

    // Check if max attempts reached
    if (attemptNumber > quiz.max_attempts) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Maximum attempts reached',
      });
    }

    // Grade the quiz
    const questions = JSON.parse(quiz.questions as string);
    let correctCount = 0;

    questions.forEach((question: any, index: number) => {
      const studentAnswer = answers[index];
      if (studentAnswer === question.correctAnswer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= quiz.passing_score;

    // Create quiz attempt
    const [attempt] = await sql`
      INSERT INTO quiz_attempts (
        quiz_id,
        student_id,
        enrollment_id,
        score,
        passed,
        answers,
        attempt_number
      )
      VALUES (
        ${quizId},
        ${studentId},
        ${enrollmentId},
        ${score},
        ${passed},
        ${JSON.stringify(answers)},
        ${attemptNumber}
      )
      RETURNING *
    `;

    // If passed, mark lesson as completed
    if (passed) {
      const [lesson] = await sql`
        SELECT id FROM lessons WHERE id = ${quiz.lesson_id}
      `;

      if (lesson) {
        // Check if lesson progress exists
        const [existingProgress] = await sql`
          SELECT * FROM lesson_progress
          WHERE enrollment_id = ${enrollmentId} AND lesson_id = ${lesson.id}
        `;

        if (!existingProgress) {
          await sql`
            INSERT INTO lesson_progress (
              enrollment_id,
              lesson_id,
              completed,
              completed_at,
              time_spent,
              last_position
            )
            VALUES (
              ${enrollmentId},
              ${lesson.id},
              true,
              NOW(),
              0,
              0
            )
          `;
        } else if (!existingProgress.completed) {
          await sql`
            UPDATE lesson_progress
            SET completed = true, completed_at = NOW()
            WHERE id = ${existingProgress.id}
          `;
        }

        // Update enrollment last accessed
        await sql`
          UPDATE enrollments
          SET
            last_accessed_lesson_id = ${lesson.id},
            last_accessed_at = NOW()
          WHERE id = ${enrollmentId}
        `;
      }
    }

    request.log.info(
      { quizId, studentId, score, passed, attemptNumber },
      'Quiz submitted'
    );

    // Return detailed results with explanations
    const detailedResults = questions.map((question: any, index: number) => ({
      question: question.question,
      options: question.options,
      studentAnswer: answers[index],
      correctAnswer: question.correctAnswer,
      isCorrect: answers[index] === question.correctAnswer,
      explanation: question.explanation,
    }));

    return reply.send({
      attemptId: attempt.id,
      score,
      passed,
      attemptNumber,
      remainingAttempts: quiz.max_attempts - attemptNumber,
      correctAnswers: correctCount,
      totalQuestions: questions.length,
      results: detailedResults,
      createdAt: attempt.created_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to submit quiz');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to submit quiz',
    });
  }
}

/**
 * Get quiz attempts for a student
 */
export async function getQuizAttempts(
  request: FastifyRequest<{
    Params: { quizId: string; studentId: string };
  }>,
  reply: FastifyReply
) {
  const { quizId, studentId } = request.params;

  try {
    const attempts = await sql`
      SELECT * FROM quiz_attempts
      WHERE quiz_id = ${quizId} AND student_id = ${studentId}
      ORDER BY created_at DESC
    `;

    return reply.send({
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        score: attempt.score,
        passed: attempt.passed,
        attemptNumber: attempt.attempt_number,
        createdAt: attempt.created_at,
      })),
    });
  } catch (error) {
    request.log.error(error, 'Failed to get quiz attempts');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve quiz attempts',
    });
  }
}
