import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  IDKitErrorCodes,
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from '@worldcoin/idkit';
import {
  ApiError,
  createCandidateLoginWorldIdRpSignature,
  createCandidateWorldIdRpSignature,
  fetchCurrentSessionUser,
  fetchWorldIdConfig,
  loginCandidate,
  loginCandidateWithWorldId,
  loginCompany,
  logoutCompany,
  sendCandidateLoginCode,
  sendCandidateVerificationCode,
  sendCompanyVerificationCode,
  sendCompanyUnlockCode,
  signupCandidate,
  signupCompany,
  verifyCandidateWorldId,
  verifyCandidateVerificationCode,
  verifyCompanyUnlockCode,
  verifyCompanyVerificationCode,
  type CandidateSessionUser,
  type CompanySessionUser,
  type WorldIdConfig,
  type WorldIdRpSignature,
} from './api';

type Role = 'candidate' | 'organizer';
type ModalStep = 'role' | 'signup' | 'success';
type LoginModalStep = 'role' | 'form';
type Screen = 'landing' | 'candidateSignup' | 'companySignup' | 'companyTemp' | 'candidateTemp';
type CandidateLoginMethod = 'worldId' | 'email';

type CandidateSignupForm = {
  name: string;
  email: string;
  verificationCode: string;
  password: string;
  organization: string;
  inviteCode: string;
  marketingConsent: boolean;
  termsAgreed: boolean;
};

type CompanySignupForm = {
  companyName: string;
  companyEmail: string;
  verificationCode: string;
  password: string;
  confirmPassword: string;
  termsAgreed: boolean;
};

type CompanyLoginForm = {
  email: string;
  password: string;
};

type CandidateLoginForm = {
  email: string;
  verificationCode: string;
};

const initialCandidateForm: CandidateSignupForm = {
  name: '',
  email: '',
  verificationCode: '',
  password: '',
  organization: '',
  inviteCode: '',
  marketingConsent: false,
  termsAgreed: false,
};

const initialCompanyForm: CompanySignupForm = {
  companyName: '',
  companyEmail: '',
  verificationCode: '',
  password: '',
  confirmPassword: '',
  termsAgreed: false,
};

const initialCompanyLoginForm: CompanyLoginForm = {
  email: '',
  password: '',
};

const initialCandidateLoginForm: CandidateLoginForm = {
  email: '',
  verificationCode: '',
};

const landingFeatureCards = [
  {
    icon: '🧠',
    title: '멀티 에이전트',
    description: [
      '5종 이상의 AI가 서로의 결과를 모른 채 독립 평가.',
      '가중치는 기업이 직접 설정.',
    ],
  },
  {
    icon: '🪪',
    title: 'World ID',
    description: [
      '실제 사람만 참여.',
      '중복·봇 차단. 개인정보는 매칭 동의 전까지 비공개.',
    ],
  },
  {
    icon: '⛓️',
    title: '온체인 감사',
    description: [
      '모든 평가 로그가 블록체인에 기록되어',
      '언제든 재현성을 검증할 수 있음.',
    ],
  },
] as const;

const agentCards = [
  {
    title: 'Technical Evaluator',
    description: '코드 구조·설계 품질',
  },
  {
    title: 'Reasoning Evaluator',
    description: '문제 접근·논리',
  },
  {
    title: 'Integrity Monitor',
    description: 'AI 대필·표절 감지',
  },
] as const;

const worldIdQrFilledCells = [
  0, 1, 2, 4, 6, 7, 8,
  11, 12, 13, 17, 22, 24, 28, 29,
  33, 34, 35, 39, 40, 44, 46, 47, 48,
  50, 52, 53, 54, 55, 57, 59, 61, 63,
  66, 67, 68, 72, 73, 77, 79, 80, 81,
  83, 85, 86, 87, 88, 90, 94, 95,
  99, 100, 101, 105, 107, 108,
  110, 112, 113, 114, 116, 118, 119, 120,
];

function WorldIdQrCode() {
  return (
    <div className="world-id-qr" aria-hidden="true">
      <div className="world-id-qr__finder world-id-qr__finder--top-left" />
      <div className="world-id-qr__finder world-id-qr__finder--top-right" />
      <div className="world-id-qr__finder world-id-qr__finder--bottom-left" />
      <div className="world-id-qr__grid">
        {Array.from({ length: 121 }, (_, index) => (
          <span
            key={index}
            className={`world-id-qr__cell${worldIdQrFilledCells.includes(index) ? ' world-id-qr__cell--filled' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

function WorldLogo({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className={`world-logo${inverted ? ' world-logo--inverted' : ''}`} aria-label="world">
      <svg
        className="world-logo__mark"
        viewBox="0 0 28 28"
        aria-hidden="true"
      >
        <circle cx="14" cy="14" r="11" />
        <path d="M4 14h20" />
        <path d="M14 3.6c-3 2.5-4.8 6.2-4.8 10.4s1.8 7.9 4.8 10.4" />
      </svg>
      <span className="world-logo__text">world</span>
    </div>
  );
}

function WorldLogoMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span
      className={`world-logo-mark${inverted ? ' world-logo-mark--inverted' : ''}`}
      aria-hidden="true"
    >
      <img
        className="world-logo-mark__image"
        src="/world-id-mark.png"
        alt=""
      />
    </span>
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>('candidate');
  const [modalStep, setModalStep] = useState<ModalStep>('role');
  const [candidateForm, setCandidateForm] =
    useState<CandidateSignupForm>(initialCandidateForm);
  const [candidateErrors, setCandidateErrors] = useState<
    Partial<Record<keyof CandidateSignupForm, string>>
  >({});
  const [candidateSubmitted, setCandidateSubmitted] = useState(false);
  const [candidateVerificationSent, setCandidateVerificationSent] = useState(false);
  const [candidateVerificationConfirmed, setCandidateVerificationConfirmed] = useState(false);
  const [candidateVerificationSecondsLeft, setCandidateVerificationSecondsLeft] = useState(0);
  const [candidateVerificationCodeExpiresSecondsLeft, setCandidateVerificationCodeExpiresSecondsLeft] = useState(0);
  const [candidateWorldIdOpen, setCandidateWorldIdOpen] = useState(false);
  const [candidateWorldIdVerified, setCandidateWorldIdVerified] = useState(false);
  const [candidateWorldIdError, setCandidateWorldIdError] = useState<string | null>(null);
  const [candidateWorldIdConflictMessage, setCandidateWorldIdConflictMessage] = useState<string | null>(null);
  const [candidateWorldIdConfig, setCandidateWorldIdConfig] = useState<WorldIdConfig | null>(null);
  const [candidateWorldIdRequest, setCandidateWorldIdRequest] = useState<WorldIdRpSignature | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanySignupForm>(initialCompanyForm);
  const [companyErrors, setCompanyErrors] = useState<
    Partial<Record<keyof CompanySignupForm, string>>
  >({});
  const [companyLoginOpen, setCompanyLoginOpen] = useState(false);
  const [companyLoginStep, setCompanyLoginStep] = useState<LoginModalStep>('role');
  const [loginRole, setLoginRole] = useState<Role>('candidate');
  const [companyLoginForm, setCompanyLoginForm] =
    useState<CompanyLoginForm>(initialCompanyLoginForm);
  const [candidateLoginForm, setCandidateLoginForm] =
    useState<CandidateLoginForm>(initialCandidateLoginForm);
  const [candidateAuthMode, setCandidateAuthMode] = useState<'signup' | 'login'>('signup');
  const [candidateLoginMethod, setCandidateLoginMethod] = useState<CandidateLoginMethod>('worldId');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);
  const [verificationSecondsLeft, setVerificationSecondsLeft] = useState(0);
  const [verificationCodeExpiresSecondsLeft, setVerificationCodeExpiresSecondsLeft] = useState(0);
  const [companySubmitError, setCompanySubmitError] = useState<string | null>(null);
  const [companyLoginError, setCompanyLoginError] = useState<string | null>(null);
  const [companyLoginNotice, setCompanyLoginNotice] = useState<string | null>(null);
  const [candidateLoginError, setCandidateLoginError] = useState<string | null>(null);
  const [candidateLoginNotice, setCandidateLoginNotice] = useState<string | null>(null);
  const [candidateLoginSent, setCandidateLoginSent] = useState(false);
  const [candidateLoginSecondsLeft, setCandidateLoginSecondsLeft] = useState(0);
  const [candidateLoginCodeExpiresSecondsLeft, setCandidateLoginCodeExpiresSecondsLeft] = useState(0);
  const [candidateLoginWorldIdOpen, setCandidateLoginWorldIdOpen] = useState(false);
  const [candidateLoginWorldIdRequest, setCandidateLoginWorldIdRequest] =
    useState<WorldIdRpSignature | null>(null);
  const [candidateLoginWorldIdError, setCandidateLoginWorldIdError] = useState<string | null>(null);
  const [isCompanyAccountLocked, setIsCompanyAccountLocked] = useState(false);
  const [companyUnlockCode, setCompanyUnlockCode] = useState('');
  const [companyUnlockSent, setCompanyUnlockSent] = useState(false);
  const [companyUnlockSecondsLeft, setCompanyUnlockSecondsLeft] = useState(0);
  const [companyUnlockCodeExpiresSecondsLeft, setCompanyUnlockCodeExpiresSecondsLeft] = useState(0);
  const [authCompanyUser, setAuthCompanyUser] = useState<CompanySessionUser | null>(null);
  const [authCandidateUser, setAuthCandidateUser] = useState<CandidateSessionUser | null>(null);
  const [authBootstrapComplete, setAuthBootstrapComplete] = useState(false);
  const [candidateSubmitError, setCandidateSubmitError] = useState<string | null>(null);
  const [isCompanySubmitting, setIsCompanySubmitting] = useState(false);
  const [isCompanyLoggingIn, setIsCompanyLoggingIn] = useState(false);
  const [isSendingCandidateLogin, setIsSendingCandidateLogin] = useState(false);
  const [isCandidateLoggingIn, setIsCandidateLoggingIn] = useState(false);
  const [isPreparingCandidateLoginWorldId, setIsPreparingCandidateLoginWorldId] = useState(false);
  const [isVerifyingCandidateLoginWorldId, setIsVerifyingCandidateLoginWorldId] = useState(false);
  const [isCandidateSubmitting, setIsCandidateSubmitting] = useState(false);
  const [isSendingCandidateVerification, setIsSendingCandidateVerification] = useState(false);
  const [isCheckingCandidateVerification, setIsCheckingCandidateVerification] = useState(false);
  const [isPreparingCandidateWorldId, setIsPreparingCandidateWorldId] = useState(false);
  const [isVerifyingCandidateWorldId, setIsVerifyingCandidateWorldId] = useState(false);
  const [isSendingCompanyVerification, setIsSendingCompanyVerification] = useState(false);
  const [isCheckingCompanyVerification, setIsCheckingCompanyVerification] = useState(false);
  const [isSendingCompanyUnlock, setIsSendingCompanyUnlock] = useState(false);
  const [isVerifyingCompanyUnlock, setIsVerifyingCompanyUnlock] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isModalOpen || companyLoginOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [companyLoginOpen, isModalOpen]);

  useEffect(() => {
    if (verificationSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setVerificationSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [verificationSent, verificationSecondsLeft]);

  useEffect(() => {
    if (verificationCodeExpiresSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setVerificationCodeExpiresSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [verificationCodeExpiresSecondsLeft]);

  useEffect(() => {
    if (candidateVerificationSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCandidateVerificationSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [candidateVerificationSecondsLeft]);

  useEffect(() => {
    if (candidateVerificationCodeExpiresSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCandidateVerificationCodeExpiresSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [candidateVerificationCodeExpiresSecondsLeft]);

  useEffect(() => {
    if (candidateLoginSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCandidateLoginSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [candidateLoginSecondsLeft]);

  useEffect(() => {
    if (candidateLoginCodeExpiresSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCandidateLoginCodeExpiresSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [candidateLoginCodeExpiresSecondsLeft]);

  useEffect(() => {
    if (companyUnlockSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCompanyUnlockSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [companyUnlockSecondsLeft]);

  useEffect(() => {
    if (companyUnlockCodeExpiresSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCompanyUnlockCodeExpiresSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [companyUnlockCodeExpiresSecondsLeft]);

  useEffect(() => {
    let isMounted = true;

    fetchCurrentSessionUser()
      .then(({ companyUser, candidateUser }) => {
        if (!isMounted) {
          return;
        }

        if (companyUser) {
          setAuthCompanyUser(companyUser);
          setAuthCandidateUser(null);
          setScreen('companyTemp');
          return;
        }

        if (candidateUser) {
          setAuthCandidateUser(candidateUser);
          setAuthCompanyUser(null);
          setCandidateAuthMode('login');
          setScreen('candidateTemp');
          return;
        }

        setAuthCompanyUser(null);
        setAuthCandidateUser(null);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setAuthCompanyUser(null);
        setAuthCandidateUser(null);
      })
      .finally(() => {
        if (isMounted) {
          setAuthBootstrapComplete(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchWorldIdConfig()
      .then((config) => {
        if (isMounted) {
          setCandidateWorldIdConfig(config);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCandidateWorldIdConfig({
            enabled: false,
            appId: null,
            action: 'candidate-signup',
            environment: 'staging',
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const modalActionLabel =
    selectedRole === 'candidate' ? '개인으로 회원가입' : '기업 / 주최자로 회원가입';
  const loginActionLabel = '로그인';
  const loginEmailLabel = loginRole === 'candidate' ? '이메일' : '기업 이메일';
  const candidateSignupTitle = '지원자 회원가입';
  const candidateSignupDescription =
    'World ID 기반 본인 확인 후 평가 세션에 참여할 수 있는 계정을 생성합니다.';

  const resetModal = () => {
    setSelectedRole('candidate');
    setModalStep('role');
    setCandidateForm(initialCandidateForm);
    setCandidateErrors({});
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetModal();
  };

  const openSignupFlow = () => {
    setScreen('landing');
    setIsModalOpen(true);
    setModalStep('role');
    setCandidateErrors({});
  };

  const openCompanySignupScreen = () => {
    setScreen('companySignup');
    setIsModalOpen(false);
    resetModal();
    setCompanyForm(initialCompanyForm);
    setCompanyErrors({});
    setCompanyLoginOpen(false);
    setCompanyLoginStep('role');
    setLoginRole('candidate');
    setCompanyLoginForm(initialCompanyLoginForm);
    setVerificationSent(false);
    setVerificationConfirmed(false);
    setVerificationSecondsLeft(0);
    setVerificationCodeExpiresSecondsLeft(0);
    setCompanySubmitError(null);
    setCompanyLoginError(null);
    setCompanyLoginNotice(null);
    setIsCompanyAccountLocked(false);
    setCompanyUnlockCode('');
    setCompanyUnlockSent(false);
    setCompanyUnlockSecondsLeft(0);
    setCompanyUnlockCodeExpiresSecondsLeft(0);
  };

  const openCandidateSignupScreen = () => {
    setScreen('candidateSignup');
    setIsModalOpen(false);
    resetModal();
    setCandidateForm(initialCandidateForm);
    setCandidateErrors({});
    setCandidateSubmitted(false);
    setCandidateVerificationSent(false);
    setCandidateVerificationConfirmed(false);
    setCandidateVerificationSecondsLeft(0);
    setCandidateVerificationCodeExpiresSecondsLeft(0);
    setCandidateWorldIdOpen(false);
    setCandidateWorldIdVerified(false);
    setCandidateWorldIdError(null);
    setCandidateWorldIdConflictMessage(null);
    setCandidateWorldIdRequest(null);
    setCandidateSubmitError(null);
  };

  const handleCandidateChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const target = event.target;
    const { name } = target;
    const value =
      target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value;

    setCandidateForm((current) => ({
      ...current,
      [name]: value,
    }));

    setCandidateErrors((current) => ({
      ...current,
      [name]: undefined,
    }));
    if (name === 'email') {
      setCandidateVerificationSent(false);
      setCandidateVerificationConfirmed(false);
      setCandidateVerificationSecondsLeft(0);
      setCandidateVerificationCodeExpiresSecondsLeft(0);
      setCandidateWorldIdVerified(false);
      setCandidateWorldIdOpen(false);
      setCandidateWorldIdRequest(null);
      setCandidateWorldIdError(null);
      setCandidateWorldIdConflictMessage(null);
    }
    if (name === 'name') {
      setCandidateWorldIdError(null);
    }
    setCandidateSubmitError(null);
  };

  const handleCompanyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    const { name } = target;
    const value = target.type === 'checkbox' ? target.checked : target.value;

    setCompanyForm((current) => ({
      ...current,
      [name]: value,
    }));

    setCompanyErrors((current) => ({
      ...current,
      [name]: undefined,
    }));
    if (name === 'companyEmail') {
      setVerificationSent(false);
      setVerificationConfirmed(false);
      setVerificationSecondsLeft(0);
      setVerificationCodeExpiresSecondsLeft(0);
    }
    setCompanySubmitError(null);
  };

  const handleCompanyLoginChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setCompanyLoginForm((current) => ({
      ...current,
      [name]: value,
    }));
    setCompanyLoginError(null);
    setCompanyLoginNotice(null);
    if (name === 'email') {
      setIsCompanyAccountLocked(false);
      setCompanyUnlockCode('');
      setCompanyUnlockSent(false);
      setCompanyUnlockSecondsLeft(0);
      setCompanyUnlockCodeExpiresSecondsLeft(0);
    }
  };

  const handleCandidateLoginChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setCandidateLoginForm((current) => ({
      ...current,
      [name]: value,
    }));
    setCandidateLoginError(null);
    setCandidateLoginNotice(null);

    if (name === 'email') {
      setCandidateLoginSent(false);
      setCandidateLoginSecondsLeft(0);
      setCandidateLoginCodeExpiresSecondsLeft(0);
      setCandidateLoginWorldIdError(null);
      setCandidateLoginForm((current) => ({
        ...current,
        verificationCode: '',
      }));
    }
  };

  const handleCandidateLoginMethodChange = (method: CandidateLoginMethod) => {
    setCandidateLoginMethod(method);
    setCandidateLoginError(null);
    setCandidateLoginNotice(null);
    setCandidateLoginWorldIdError(null);
  };

  const validateCandidateForm = () => {
    const nextErrors: Partial<Record<keyof CandidateSignupForm, string>> = {};

    if (!candidateForm.name.trim()) {
      nextErrors.name = '이름을 입력해주세요.';
    }

    if (!candidateForm.email.trim()) {
      nextErrors.email = '이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateForm.email)) {
      nextErrors.email = '올바른 이메일 형식을 입력해주세요.';
    }

    if (!candidateForm.termsAgreed) {
      nextErrors.termsAgreed = '이용약관 및 개인정보처리방침 동의가 필요합니다.';
    }

    if (!candidateVerificationConfirmed) {
      nextErrors.verificationCode = '이메일 인증을 완료해주세요.';
    }

    setCandidateWorldIdError((current) => {
      if (!candidateVerificationConfirmed || candidateWorldIdVerified) {
        return null;
      }

      return candidateWorldIdConflictMessage ?? current ?? 'World ID 인증을 완료해주세요.';
    });

    setCandidateErrors(nextErrors);

    return Object.keys(nextErrors).length === 0 && candidateWorldIdVerified;
  };

  const handleCandidateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateCandidateForm()) {
      return;
    }

    try {
      setIsCandidateSubmitting(true);
      setCandidateSubmitError(null);

      const { candidateUser } = await signupCandidate({
        name: candidateForm.name.trim(),
        email: candidateForm.email.trim(),
        marketingConsent: candidateForm.marketingConsent,
        termsAgreed: candidateForm.termsAgreed,
      });

      setCandidateAuthMode('signup');
      setAuthCandidateUser(candidateUser);
      setAuthCompanyUser(null);
      setScreen('candidateTemp');
    } catch (error) {
      setCandidateSubmitError(
        error instanceof Error ? error.message : '회원가입 처리 중 오류가 발생했습니다.',
      );
    } finally {
      setIsCandidateSubmitting(false);
    }
  };

  const handleCandidateLoginSend = async () => {
    const email = candidateLoginForm.email.trim();

    if (!email) {
      setCandidateLoginError('이메일을 입력해주세요.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCandidateLoginError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    try {
      setIsSendingCandidateLogin(true);
      setCandidateLoginError(null);
      setCandidateLoginNotice(null);

      const response = await sendCandidateLoginCode({ email });

      setCandidateLoginSent(true);
      setCandidateLoginSecondsLeft(response.retryAfterSeconds ?? 60);
      setCandidateLoginCodeExpiresSecondsLeft(response.expiresInSeconds ?? 600);
      setCandidateLoginNotice('로그인 이메일 인증코드를 발송했습니다.');
    } catch (error) {
      if (error instanceof ApiError && typeof error.retryAfterSeconds === 'number') {
        setCandidateLoginSecondsLeft(error.retryAfterSeconds);
      }

      setCandidateLoginError(
        error instanceof Error ? error.message : '로그인 이메일 인증코드 발송 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSendingCandidateLogin(false);
    }
  };

  const handleCandidateLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = candidateLoginForm.email.trim();
    const verificationCode = candidateLoginForm.verificationCode.trim();

    if (!email) {
      setCandidateLoginError('이메일을 입력해주세요.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCandidateLoginError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    if (!verificationCode) {
      setCandidateLoginError('로그인 이메일 인증코드를 입력해주세요.');
      return;
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      setCandidateLoginError('인증번호 6자리를 입력해주세요.');
      return;
    }

    try {
      setIsCandidateLoggingIn(true);
      setCandidateLoginError(null);
      setCandidateLoginNotice(null);

      const { candidateUser } = await loginCandidate({
        email,
        verificationCode,
      });

      setCandidateAuthMode('login');
      setAuthCandidateUser(candidateUser);
      setAuthCompanyUser(null);
      setCandidateLoginSent(false);
      setCandidateLoginSecondsLeft(0);
      setCandidateLoginCodeExpiresSecondsLeft(0);
      setCompanyLoginOpen(false);
      setCompanyLoginStep('role');
      setScreen('candidateTemp');
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'CANDIDATE_LOGIN_CODE_RESET' &&
        typeof error.retryAfterSeconds === 'number'
      ) {
        setCandidateLoginSent(false);
        setCandidateLoginSecondsLeft(error.retryAfterSeconds);
        setCandidateLoginCodeExpiresSecondsLeft(0);
        setCandidateLoginForm((current) => ({
          ...current,
          verificationCode: '',
        }));
      }

      setCandidateLoginError(error instanceof Error ? error.message : '로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsCandidateLoggingIn(false);
    }
  };

  const handleCandidateLoginWorldIdStart = async () => {
    if (!candidateWorldIdConfig?.enabled) {
      setCandidateLoginWorldIdError(
        'World ID가 아직 설정되지 않았습니다. .env의 World ID 값을 먼저 채워주세요.',
      );
      return;
    }

    try {
      setIsPreparingCandidateLoginWorldId(true);
      setCandidateLoginWorldIdError(null);
      setCandidateLoginError(null);
      setCandidateLoginNotice(null);

      const response = await createCandidateLoginWorldIdRpSignature();

      setCandidateLoginWorldIdRequest(response);
      setCandidateLoginWorldIdOpen(true);
    } catch (error) {
      setCandidateLoginWorldIdError(
        error instanceof Error ? error.message : 'World ID 로그인 준비 중 오류가 발생했습니다.',
      );
    } finally {
      setIsPreparingCandidateLoginWorldId(false);
    }
  };

  const handleCandidateLoginWorldIdVerify = async (result: IDKitResult) => {
    try {
      setIsVerifyingCandidateLoginWorldId(true);
      setCandidateLoginWorldIdError(null);

      const { candidateUser } = await loginCandidateWithWorldId({
        idkitResponse: result,
      });

      setCandidateAuthMode('login');
      setAuthCandidateUser(candidateUser);
      setAuthCompanyUser(null);
    } catch (error) {
      setCandidateLoginWorldIdError(
        error instanceof Error ? error.message : 'World ID 로그인 처리 중 오류가 발생했습니다.',
      );
      throw error;
    } finally {
      setIsVerifyingCandidateLoginWorldId(false);
    }
  };

  const handleCandidateLoginWorldIdSuccess = () => {
    setCandidateLoginWorldIdOpen(false);
    setCompanyLoginOpen(false);
    setCompanyLoginStep('role');
    setCandidateAuthMode('login');
    setScreen('candidateTemp');
  };

  const handleCandidateLoginWorldIdError = (errorCode: IDKitErrorCodes) => {
    if (errorCode === IDKitErrorCodes.FailedByHostApp) {
      setCandidateLoginWorldIdOpen(false);
      return;
    }

    const nextMessage =
      errorCode === IDKitErrorCodes.Cancelled ||
      errorCode === IDKitErrorCodes.UserRejected ||
      errorCode === IDKitErrorCodes.VerificationRejected
        ? 'World ID 로그인이 취소되었습니다. 다시 시도해주세요.'
        : errorCode === IDKitErrorCodes.ConnectionFailed
          ? 'World ID 연결이 끊어졌습니다. 다시 시도해주세요.'
          : 'World ID 로그인을 완료하지 못했습니다. 다시 시도해주세요.';

    setCandidateLoginWorldIdError(nextMessage);
  };

  const handleCandidateVerificationSend = async () => {
    if (!candidateForm.email.trim()) {
      setCandidateErrors((current) => ({
        ...current,
        email: '이메일을 입력해주세요.',
      }));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateForm.email)) {
      setCandidateErrors((current) => ({
        ...current,
        email: '올바른 이메일 형식을 입력해주세요.',
      }));
      return;
    }

    try {
      setIsSendingCandidateVerification(true);
      setCandidateSubmitError(null);

      const response = await sendCandidateVerificationCode({
        email: candidateForm.email.trim(),
      });

      setCandidateErrors((current) => ({
        ...current,
        email: undefined,
        verificationCode: undefined,
      }));
      setCandidateVerificationSent(true);
      setCandidateVerificationConfirmed(false);
      setCandidateVerificationSecondsLeft(response.retryAfterSeconds ?? 60);
      setCandidateVerificationCodeExpiresSecondsLeft(response.expiresInSeconds ?? 600);
    } catch (error) {
      if (error instanceof ApiError && typeof error.retryAfterSeconds === 'number') {
        setCandidateVerificationSecondsLeft(error.retryAfterSeconds);
      }
      setCandidateSubmitError(
        error instanceof Error ? error.message : '인증코드 발송 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSendingCandidateVerification(false);
    }
  };

  const handleCandidateVerificationCheck = async () => {
    if (!candidateForm.verificationCode.trim()) {
      setCandidateErrors((current) => ({
        ...current,
        verificationCode: '인증번호를 입력해주세요.',
      }));
      return;
    }

    if (!/^\d{6}$/.test(candidateForm.verificationCode.trim())) {
      setCandidateErrors((current) => ({
        ...current,
        verificationCode: '인증번호 6자리를 입력해주세요.',
      }));
      return;
    }

    try {
      setIsCheckingCandidateVerification(true);
      setCandidateSubmitError(null);

      await verifyCandidateVerificationCode({
        email: candidateForm.email.trim(),
        verificationCode: candidateForm.verificationCode.trim(),
      });

      setCandidateErrors((current) => ({
        ...current,
        verificationCode: undefined,
      }));
      setCandidateVerificationConfirmed(true);
      setCandidateWorldIdError(null);
      setCandidateWorldIdConflictMessage(null);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'CANDIDATE_SIGNUP_CODE_RESET' &&
        typeof error.retryAfterSeconds === 'number'
      ) {
        setCandidateVerificationSent(false);
        setCandidateVerificationCodeExpiresSecondsLeft(0);
        setCandidateVerificationSecondsLeft(error.retryAfterSeconds);
        setCandidateForm((current) => ({
          ...current,
          verificationCode: '',
        }));
      }

      setCandidateErrors((current) => ({
        ...current,
        verificationCode:
          error instanceof Error ? error.message : '인증 확인 중 오류가 발생했습니다.',
      }));
      setCandidateVerificationConfirmed(false);
    } finally {
      setIsCheckingCandidateVerification(false);
    }
  };

  const handleCandidateWorldIdStart = async () => {
    if (!candidateVerificationConfirmed) {
      setCandidateWorldIdError('먼저 이메일 인증을 완료해주세요.');
      return;
    }

    if (!candidateWorldIdConfig?.enabled) {
      setCandidateWorldIdError(
        'World ID가 아직 설정되지 않았습니다. .env의 World ID 값을 먼저 채워주세요.',
      );
      return;
    }

    try {
      setIsPreparingCandidateWorldId(true);
      setCandidateWorldIdError(null);
      setCandidateWorldIdConflictMessage(null);

      const response = await createCandidateWorldIdRpSignature({
        email: candidateForm.email.trim(),
      });

      setCandidateWorldIdRequest(response);
      setCandidateWorldIdOpen(true);
    } catch (error) {
      setCandidateWorldIdError(
        error instanceof Error ? error.message : 'World ID 인증 준비 중 오류가 발생했습니다.',
      );
    } finally {
      setIsPreparingCandidateWorldId(false);
    }
  };

  const handleCandidateWorldIdVerify = async (result: IDKitResult) => {
    try {
      setIsVerifyingCandidateWorldId(true);
      setCandidateWorldIdError(null);
      setCandidateWorldIdConflictMessage(null);

      await verifyCandidateWorldId({
        email: candidateForm.email.trim(),
        idkitResponse: result,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setCandidateWorldIdConflictMessage(error.message);
      }

      setCandidateWorldIdError(
        error instanceof Error ? error.message : 'World ID 검증 중 오류가 발생했습니다.',
      );
      throw error;
    } finally {
      setIsVerifyingCandidateWorldId(false);
    }
  };

  const handleCandidateWorldIdSuccess = () => {
    setCandidateWorldIdVerified(true);
    setCandidateWorldIdError(null);
    setCandidateWorldIdConflictMessage(null);
    setCandidateWorldIdOpen(false);
  };

  const handleCandidateWorldIdError = (errorCode: IDKitErrorCodes) => {
    if (errorCode === IDKitErrorCodes.FailedByHostApp) {
      setCandidateWorldIdOpen(false);
      return;
    }

    const nextMessage =
      errorCode === IDKitErrorCodes.Cancelled ||
      errorCode === IDKitErrorCodes.UserRejected ||
      errorCode === IDKitErrorCodes.VerificationRejected
        ? 'World ID 인증이 취소되었습니다. 다시 시도해주세요.'
        : errorCode === IDKitErrorCodes.ConnectionFailed
          ? 'World ID 연결이 끊어졌습니다. 다시 시도해주세요.'
          : 'World ID 인증을 완료하지 못했습니다. 다시 시도해주세요.';

    setCandidateWorldIdError((current) => current ?? candidateWorldIdConflictMessage ?? nextMessage);
  };

  const validateCompanyEmail = () => {
    if (!companyForm.companyEmail.trim()) {
      setCompanyErrors((current) => ({
        ...current,
        companyEmail: '기업 이메일을 입력해주세요.',
      }));
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyForm.companyEmail)) {
      setCompanyErrors((current) => ({
        ...current,
        companyEmail: '올바른 이메일 형식을 입력해주세요.',
      }));
      return false;
    }

    setCompanyErrors((current) => ({
      ...current,
      companyEmail: undefined,
    }));
    return true;
  };

  const handleVerificationSend = async () => {
    if (!validateCompanyEmail()) {
      return;
    }

    try {
      setIsSendingCompanyVerification(true);
      setCompanySubmitError(null);

      const response = await sendCompanyVerificationCode({
        companyEmail: companyForm.companyEmail.trim(),
      });

      setVerificationSent(true);
      setVerificationConfirmed(false);
      setVerificationSecondsLeft(response.retryAfterSeconds ?? 60);
      setVerificationCodeExpiresSecondsLeft(response.expiresInSeconds ?? 600);
      setCompanyErrors((current) => ({
        ...current,
        verificationCode: undefined,
        password: undefined,
        confirmPassword: undefined,
      }));
    } catch (error) {
      if (error instanceof ApiError && typeof error.retryAfterSeconds === 'number') {
        setVerificationSecondsLeft(error.retryAfterSeconds);
      }
      setCompanySubmitError(
        error instanceof Error ? error.message : '인증코드 발송 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSendingCompanyVerification(false);
    }
  };

  const handleVerificationCheck = async () => {
    if (!companyForm.verificationCode.trim()) {
      setCompanyErrors((current) => ({
        ...current,
        verificationCode: '인증번호를 입력해주세요.',
      }));
      return;
    }

    if (!/^\d{6}$/.test(companyForm.verificationCode.trim())) {
      setCompanyErrors((current) => ({
        ...current,
        verificationCode: '인증번호 6자리를 입력해주세요.',
      }));
      return;
    }

    try {
      setIsCheckingCompanyVerification(true);
      setCompanySubmitError(null);

      await verifyCompanyVerificationCode({
        companyEmail: companyForm.companyEmail.trim(),
        verificationCode: companyForm.verificationCode.trim(),
      });

      setCompanyErrors((current) => ({
        ...current,
        verificationCode: undefined,
      }));
      setVerificationConfirmed(true);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'SIGNUP_CODE_RESET' &&
        typeof error.retryAfterSeconds === 'number'
      ) {
        setVerificationSent(false);
        setVerificationCodeExpiresSecondsLeft(0);
        setVerificationSecondsLeft(error.retryAfterSeconds);
        setCompanyForm((current) => ({
          ...current,
          verificationCode: '',
        }));
      }
      setCompanyErrors((current) => ({
        ...current,
        verificationCode:
          error instanceof Error ? error.message : '인증 확인 중 오류가 발생했습니다.',
      }));
      setVerificationConfirmed(false);
    } finally {
      setIsCheckingCompanyVerification(false);
    }
  };

  const validateCompanyForm = () => {
    const nextErrors: Partial<Record<keyof CompanySignupForm, string>> = {};

    if (!companyForm.companyName.trim()) {
      nextErrors.companyName = '기업명을 입력해주세요.';
    }

    if (!companyForm.companyEmail.trim()) {
      nextErrors.companyEmail = '기업 이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyForm.companyEmail)) {
      nextErrors.companyEmail = '올바른 이메일 형식을 입력해주세요.';
    }

    if (!companyForm.termsAgreed) {
      nextErrors.termsAgreed = '이용약관 동의가 필요합니다.';
    }

    if (!verificationConfirmed) {
      nextErrors.verificationCode = '이메일 인증을 완료해주세요.';
    }

    if (verificationConfirmed) {
      if (!companyForm.password.trim()) {
        nextErrors.password = '비밀번호를 입력해주세요.';
      } else if (companyForm.password.length < 8) {
        nextErrors.password = '비밀번호는 8자 이상이어야 합니다.';
      }

      if (!companyForm.confirmPassword.trim()) {
        nextErrors.confirmPassword = '비밀번호 재확인을 입력해주세요.';
      } else if (companyForm.confirmPassword !== companyForm.password) {
        nextErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
      }
    }

    setCompanyErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleCompanySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateCompanyForm()) {
      return;
    }

    try {
      setIsCompanySubmitting(true);
      setCompanySubmitError(null);

      const { companyUser } = await signupCompany({
        companyName: companyForm.companyName.trim(),
        companyEmail: companyForm.companyEmail.trim(),
        password: companyForm.password,
        termsAgreed: companyForm.termsAgreed,
      });

      setAuthCompanyUser(companyUser);
      setScreen('companyTemp');
    } catch (error) {
      setCompanySubmitError(
        error instanceof Error ? error.message : '회원가입 처리 중 오류가 발생했습니다.',
      );
    } finally {
      setIsCompanySubmitting(false);
    }
  };

  const handleCompanyLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsCompanyLoggingIn(true);
      setCompanyLoginError(null);
      setCompanyLoginNotice(null);

      const { companyUser } = await loginCompany({
        email: companyLoginForm.email.trim(),
        password: companyLoginForm.password,
      });

      setAuthCompanyUser(companyUser);
      setIsCompanyAccountLocked(false);
      setCompanyUnlockCode('');
      setCompanyUnlockSent(false);
      setCompanyUnlockSecondsLeft(0);
      setCompanyUnlockCodeExpiresSecondsLeft(0);
      setCompanyLoginOpen(false);
      setCompanyLoginStep('role');
      setScreen('companyTemp');
    } catch (error) {
      if (error instanceof ApiError && error.status === 423) {
        setIsCompanyAccountLocked(true);
      }

      setCompanyLoginError(error instanceof Error ? error.message : '로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsCompanyLoggingIn(false);
    }
  };

  const handleCompanyUnlockSend = async () => {
    const email = companyLoginForm.email.trim();

    if (!email) {
      setCompanyLoginError('기업 이메일을 입력해주세요.');
      return;
    }

    try {
      setIsSendingCompanyUnlock(true);
      setCompanyLoginError(null);
      setCompanyLoginNotice(null);

      const response = await sendCompanyUnlockCode({
        companyEmail: email,
      });

      setCompanyUnlockSent(true);
      setCompanyUnlockSecondsLeft(response.retryAfterSeconds ?? 60);
      setCompanyUnlockCodeExpiresSecondsLeft(response.expiresInSeconds ?? 600);
      setCompanyLoginNotice('잠금 해제 인증코드를 이메일로 발송했습니다.');
    } catch (error) {
      if (error instanceof ApiError && typeof error.retryAfterSeconds === 'number') {
        setCompanyUnlockSecondsLeft(error.retryAfterSeconds);
      }
      setCompanyLoginError(
        error instanceof Error ? error.message : '잠금 해제 인증코드 발송 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSendingCompanyUnlock(false);
    }
  };

  const handleCompanyUnlockVerify = async () => {
    if (!companyUnlockCode.trim()) {
      setCompanyLoginError('잠금 해제 인증코드를 입력해주세요.');
      return;
    }

    if (!/^\d{6}$/.test(companyUnlockCode.trim())) {
      setCompanyLoginError('인증코드 6자리를 입력해주세요.');
      return;
    }

    try {
      setIsVerifyingCompanyUnlock(true);
      setCompanyLoginError(null);
      setCompanyLoginNotice(null);

      const response = await verifyCompanyUnlockCode({
        companyEmail: companyLoginForm.email.trim(),
        verificationCode: companyUnlockCode.trim(),
      });

      setIsCompanyAccountLocked(false);
      setCompanyUnlockCode('');
      setCompanyUnlockSent(false);
      setCompanyUnlockSecondsLeft(0);
      setCompanyUnlockCodeExpiresSecondsLeft(0);
      setCompanyLoginNotice(response.message);
      setCompanyLoginForm((current) => ({
        ...current,
        password: '',
      }));
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'UNLOCK_CODE_RESET' &&
        typeof error.retryAfterSeconds === 'number'
      ) {
        setCompanyUnlockSent(false);
        setCompanyUnlockCode('');
        setCompanyUnlockSecondsLeft(error.retryAfterSeconds);
        setCompanyUnlockCodeExpiresSecondsLeft(0);
      }
      setCompanyLoginError(
        error instanceof Error ? error.message : '잠금 해제 처리 중 오류가 발생했습니다.',
      );
    } finally {
      setIsVerifyingCompanyUnlock(false);
    }
  };

  const openLoginFlow = () => {
    setCompanyLoginOpen(true);
    setCompanyLoginStep('role');
    setLoginRole('candidate');
    setCompanyLoginForm(initialCompanyLoginForm);
    setCandidateLoginForm(initialCandidateLoginForm);
    setCandidateLoginMethod('worldId');
    setCompanyLoginError(null);
    setCompanyLoginNotice(null);
    setCandidateLoginError(null);
    setCandidateLoginNotice(null);
    setCandidateLoginSent(false);
    setCandidateLoginSecondsLeft(0);
    setCandidateLoginCodeExpiresSecondsLeft(0);
    setCandidateLoginWorldIdOpen(false);
    setCandidateLoginWorldIdRequest(null);
    setCandidateLoginWorldIdError(null);
    setIsCompanyAccountLocked(false);
    setCompanyUnlockCode('');
    setCompanyUnlockSent(false);
    setCompanyUnlockSecondsLeft(0);
    setCompanyUnlockCodeExpiresSecondsLeft(0);
  };

  const closeCompanyLogin = () => {
    setCompanyLoginOpen(false);
    setCompanyLoginStep('role');
    setLoginRole('candidate');
    setCompanyLoginForm(initialCompanyLoginForm);
    setCandidateLoginForm(initialCandidateLoginForm);
    setCandidateLoginMethod('worldId');
    setCompanyLoginError(null);
    setCompanyLoginNotice(null);
    setCandidateLoginError(null);
    setCandidateLoginNotice(null);
    setCandidateLoginSent(false);
    setCandidateLoginSecondsLeft(0);
    setCandidateLoginCodeExpiresSecondsLeft(0);
    setCandidateLoginWorldIdOpen(false);
    setCandidateLoginWorldIdRequest(null);
    setCandidateLoginWorldIdError(null);
    setIsCompanyAccountLocked(false);
    setCompanyUnlockCode('');
    setCompanyUnlockSent(false);
    setCompanyUnlockSecondsLeft(0);
    setCompanyUnlockCodeExpiresSecondsLeft(0);
  };

  const openSelectedLoginForm = () => {
    setCompanyLoginStep('form');
  };

  const verificationTimerLabel = `${String(Math.floor(verificationSecondsLeft / 60)).padStart(2, '0')}:${String(
    verificationSecondsLeft % 60,
  ).padStart(2, '0')}`;
  const companyVerificationCodePlaceholder =
    verificationCodeExpiresSecondsLeft > 0
      ? `남은 시간 ${String(Math.floor(verificationCodeExpiresSecondsLeft / 60)).padStart(2, '0')}:${String(
          verificationCodeExpiresSecondsLeft % 60,
        ).padStart(2, '0')}`
      : '인증코드 입력';
  const candidateVerificationTimerLabel = `${String(
    Math.floor(candidateVerificationSecondsLeft / 60),
  ).padStart(2, '0')}:${String(candidateVerificationSecondsLeft % 60).padStart(2, '0')}`;
  const candidateVerificationCodePlaceholder =
    candidateVerificationCodeExpiresSecondsLeft > 0
      ? `남은 시간 ${String(Math.floor(candidateVerificationCodeExpiresSecondsLeft / 60)).padStart(2, '0')}:${String(
          candidateVerificationCodeExpiresSecondsLeft % 60,
        ).padStart(2, '0')}`
      : '인증코드 입력';
  const candidateWorldIdButtonLabel = isPreparingCandidateWorldId
    ? '준비 중...'
    : candidateWorldIdVerified
      ? '다시 인증 →'
      : '인증 시작 →';
  const candidateLoginCodePlaceholder =
    candidateLoginCodeExpiresSecondsLeft > 0
      ? `남은 시간 ${String(Math.floor(candidateLoginCodeExpiresSecondsLeft / 60)).padStart(2, '0')}:${String(
          candidateLoginCodeExpiresSecondsLeft % 60,
        ).padStart(2, '0')}`
      : '인증코드 입력';
  const companyUnlockTimerLabel = `${String(Math.floor(companyUnlockSecondsLeft / 60)).padStart(2, '0')}:${String(
    companyUnlockSecondsLeft % 60,
  ).padStart(2, '0')}`;
  const companyUnlockCodePlaceholder =
    companyUnlockCodeExpiresSecondsLeft > 0
      ? `남은 시간 ${String(Math.floor(companyUnlockCodeExpiresSecondsLeft / 60)).padStart(2, '0')}:${String(
          companyUnlockCodeExpiresSecondsLeft % 60,
        ).padStart(2, '0')}`
      : '인증코드 입력';

  const handleCompanyLogout = async () => {
    try {
      await logoutCompany();
    } catch {
      // Even if the server session is already gone, the local UI should recover.
    } finally {
      setAuthCompanyUser(null);
      setAuthCandidateUser(null);
      setScreen('landing');
    }
  };

  const renderLoginLayer = () => {
    if (!companyLoginOpen) {
      return null;
    }

    return (
      <>
        <div className="company-login-layer" role="presentation">
          <button
            type="button"
            className="company-login-layer__backdrop"
            aria-label="로그인 모달 닫기"
            onClick={closeCompanyLogin}
          />

          {companyLoginStep === 'role' ? (
            <section
              className="role-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="login-role-modal-title"
            >
              <div className="role-modal__header">
                <WorldLogo />
                <button
                  type="button"
                  className="role-modal__close"
                  aria-label="닫기"
                  onClick={closeCompanyLogin}
                >
                  ×
                </button>
              </div>

              <h3 id="login-role-modal-title">역할 선택</h3>

              <div className="role-modal__selector" aria-label="로그인 역할 선택">
                <button
                  type="button"
                  className={`role-pill${loginRole === 'candidate' ? ' role-pill--active' : ''}`}
                  onClick={() => setLoginRole('candidate')}
                >
                  지원자 (개인)
                </button>
                <button
                  type="button"
                  className={`role-pill${loginRole === 'organizer' ? ' role-pill--active' : ''}`}
                  onClick={() => setLoginRole('organizer')}
                >
                  기업 / 주최자
                </button>
              </div>

              <button
                type="button"
                className="role-modal__cta"
                onClick={openSelectedLoginForm}
              >
                {loginActionLabel}
              </button>
            </section>
          ) : loginRole === 'candidate' ? (
            <section
              className="company-login-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="candidate-login-title"
            >
              <div className="company-login-modal__header">
                <WorldLogo />
                <button
                  type="button"
                  className="company-login-modal__close"
                  aria-label="닫기"
                  onClick={closeCompanyLogin}
                >
                  ×
                </button>
              </div>

            <div className="company-login-modal__intro">
              <h3 id="candidate-login-title">지원자 로그인</h3>
              <p>World ID 또는 이메일 인증으로 로그인할 수 있습니다.</p>
            </div>

            <div className="role-modal__selector" aria-label="지원자 로그인 수단 선택">
              <button
                type="button"
                className={`role-pill${candidateLoginMethod === 'worldId' ? ' role-pill--active' : ''}`}
                onClick={() => handleCandidateLoginMethodChange('worldId')}
              >
                World ID
              </button>
              <button
                type="button"
                className={`role-pill${candidateLoginMethod === 'email' ? ' role-pill--active' : ''}`}
                onClick={() => handleCandidateLoginMethodChange('email')}
              >
                이메일 인증
              </button>
            </div>

            {candidateLoginMethod === 'email' ? (
              <form className="company-login-form" onSubmit={handleCandidateLoginSubmit}>
                <label className="company-field">
                  <span className="company-field__label">이메일</span>
                  <input
                    className="company-field__input"
                    type="email"
                    name="email"
                    value={candidateLoginForm.email}
                    onChange={handleCandidateLoginChange}
                  />
                </label>

                <button
                  type="button"
                  className="company-login-unlock__send"
                  onClick={handleCandidateLoginSend}
                  disabled={isSendingCandidateLogin || candidateLoginSecondsLeft > 0}
                >
                  {isSendingCandidateLogin ? '발송 중...' : '로그인 이메일 인증코드 보내기'}
                </button>

                {candidateLoginSecondsLeft > 0 ? (
                  <p className="company-login-unlock__cooldown" role="status">
                    {candidateLoginSecondsLeft}초 뒤에 다시 요청할 수 있습니다.
                  </p>
                ) : null}

                {candidateLoginSent ? (
                  <label className="company-field company-login-unlock__field">
                    <span className="company-field__label">로그인 이메일 인증코드</span>
                    <input
                      className="company-field__input"
                      type="text"
                      name="verificationCode"
                      placeholder={candidateLoginCodePlaceholder}
                      value={candidateLoginForm.verificationCode}
                      onChange={handleCandidateLoginChange}
                    />
                  </label>
                ) : null}

                {candidateLoginError ? (
                  <p className="company-form__server-error" role="alert">
                    {candidateLoginError}
                  </p>
                ) : null}

                {candidateLoginNotice ? (
                  <p className="company-form__server-notice" role="status">
                    {candidateLoginNotice}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="company-login-form__submit"
                  disabled={!candidateLoginSent}
                >
                  {isCandidateLoggingIn ? '로그인 중...' : '로그인'}
                </button>
              </form>
            ) : (
              <div className="company-login-form">
                <section className="candidate-form__world-id" aria-label="World ID 로그인 안내">
                  <div className="candidate-form__world-id-icon" aria-hidden="true">
                    <WorldLogoMark inverted={true} />
                  </div>
                  <div className="candidate-form__world-id-copy">
                    <strong>
                      {candidateWorldIdConfig?.enabled ? 'World ID 로그인' : 'World ID 설정 필요'}
                    </strong>
                    <span>
                      {candidateWorldIdConfig?.enabled
                        ? '가입에 사용한 동일한 World ID로 로그인할 수 있습니다.'
                        : 'Developer Portal에서 발급한 World ID 설정값이 필요합니다.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="candidate-form__world-id-button"
                    onClick={handleCandidateLoginWorldIdStart}
                    disabled={isPreparingCandidateLoginWorldId || isVerifyingCandidateLoginWorldId}
                  >
                    {isPreparingCandidateLoginWorldId ? '준비 중...' : 'World ID로 로그인'}
                  </button>
                </section>

                {candidateLoginWorldIdError ? (
                  <p className="company-form__server-error" role="alert">
                    {candidateLoginWorldIdError}
                  </p>
                ) : null}
              </div>
            )}
            </section>
          ) : (
            <section
              className="company-login-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="company-login-title"
            >
            <div className="company-login-modal__header">
              <WorldLogo />
              <button
                type="button"
                className="company-login-modal__close"
                aria-label="닫기"
                onClick={closeCompanyLogin}
              >
                ×
              </button>
            </div>

            <form className="company-login-form" onSubmit={handleCompanyLoginSubmit}>
              <label className="company-field">
                <span className="company-field__label">{loginEmailLabel}</span>
                <input
                  className="company-field__input"
                  type="email"
                  name="email"
                  value={companyLoginForm.email}
                  onChange={handleCompanyLoginChange}
                />
              </label>

              {!isCompanyAccountLocked ? (
                <label className="company-field company-login-form__password">
                  <span className="company-field__label">비밀번호</span>
                  <input
                    className="company-field__input"
                    type="password"
                    name="password"
                    value={companyLoginForm.password}
                    onChange={handleCompanyLoginChange}
                  />
                </label>
              ) : null}

              {isCompanyAccountLocked ? (
                <>
                  <p className="company-login-unlock__copy">
                    이메일 인증코드로 계정 잠금을 해제한 뒤 다시 로그인해주세요.
                  </p>

                  <button
                    type="button"
                    className="company-login-unlock__send"
                    onClick={handleCompanyUnlockSend}
                    disabled={isSendingCompanyUnlock || companyUnlockSecondsLeft > 0}
                  >
                    {isSendingCompanyUnlock ? '발송 중...' : '잠금 해제 인증코드 보내기'}
                  </button>

                  {companyUnlockSecondsLeft > 0 ? (
                    <p className="company-login-unlock__cooldown" role="status">
                      {companyUnlockSecondsLeft}초 뒤에 다시 요청할 수 있습니다.
                    </p>
                  ) : null}

                  {companyUnlockSent ? (
                    <>
                      <label className="company-field company-login-unlock__field">
                        <span className="company-field__label">잠금 해제 인증코드</span>
                        <input
                          className="company-field__input"
                          type="text"
                          name="companyUnlockCode"
                          placeholder={companyUnlockCodePlaceholder}
                          value={companyUnlockCode}
                          onChange={(event) => {
                            setCompanyUnlockCode(event.target.value);
                            setCompanyLoginError(null);
                            setCompanyLoginNotice(null);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        className="company-login-unlock__confirm"
                        onClick={handleCompanyUnlockVerify}
                        disabled={isVerifyingCompanyUnlock}
                      >
                        {isVerifyingCompanyUnlock ? '해제 중...' : '잠금 해제'}
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}

              {companyLoginError ? (
                <p className="company-form__server-error" role="alert">
                  {companyLoginError}
                </p>
              ) : null}

              {companyLoginNotice ? (
                <p className="company-form__server-notice" role="status">
                  {companyLoginNotice}
                </p>
              ) : null}

              {!isCompanyAccountLocked ? (
                <button type="submit" className="company-login-form__submit">
                  {isCompanyLoggingIn ? '로그인 중...' : '로그인'}
                </button>
              ) : null}
            </form>
            </section>
          )}
        </div>

        {candidateLoginWorldIdRequest ? (
          <IDKitRequestWidget
            open={candidateLoginWorldIdOpen}
            onOpenChange={setCandidateLoginWorldIdOpen}
            app_id={candidateLoginWorldIdRequest.appId}
            action={candidateLoginWorldIdRequest.action}
            rp_context={candidateLoginWorldIdRequest.rpContext as RpContext}
            allow_legacy_proofs={true}
            environment={candidateLoginWorldIdRequest.environment}
            preset={orbLegacy()}
            handleVerify={handleCandidateLoginWorldIdVerify}
            onSuccess={handleCandidateLoginWorldIdSuccess}
            onError={handleCandidateLoginWorldIdError}
          />
        ) : null}
      </>
    );
  };

  if (!authBootstrapComplete) {
    return (
      <div className="page-shell page-shell--loading">
        <main className="auth-loading">
          <strong>세션을 확인하고 있습니다.</strong>
          <p>잠시만 기다려주세요.</p>
        </main>
      </div>
    );
  }

  if (screen === 'companyTemp' && authCompanyUser) {
    return (
      <div className="page-shell temp-page-shell">
        <main className="temp-page">
          <div className="temp-page__badge">임시 페이지</div>
          <h1>{authCompanyUser.companyName} 님, 로그인되었습니다.</h1>
          <p>
            기업회원가입 또는 로그인이 정상적으로 완료되었습니다.
            다음 단계 구현 전까지는 이 페이지를 임시 랜딩으로 사용합니다.
          </p>

          <div className="temp-page__summary">
            <div>
              <span>기업명</span>
              <strong>{authCompanyUser.companyName}</strong>
            </div>
            <div>
              <span>기업 이메일</span>
              <strong>{authCompanyUser.companyEmail}</strong>
            </div>
          </div>

          <div className="temp-page__actions">
            <button
              type="button"
              className="ghost-button ghost-button--wide"
              onClick={() => setScreen('landing')}
            >
              랜딩 보기
            </button>
            <button
              type="button"
              className="solid-button solid-button--wide"
              onClick={handleCompanyLogout}
            >
              로그아웃
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (screen === 'candidateTemp' && authCandidateUser) {
    return (
      <div className="page-shell temp-page-shell">
        <main className="temp-page">
          <div className="temp-page__badge">임시 페이지</div>
          <h1>
            {authCandidateUser.name} 님, {candidateAuthMode === 'signup' ? '가입이 완료되었습니다.' : '로그인되었습니다.'}
          </h1>
          <p>
            {candidateAuthMode === 'signup'
              ? '개인 회원가입과 자동 로그인이 정상적으로 완료되었습니다.'
              : '개인 로그인이 정상적으로 완료되었습니다.'}
            다음 단계 구현 전까지는 이 페이지를 임시 랜딩으로 사용합니다.
          </p>

          <div className="temp-page__summary">
            <div>
              <span>이름</span>
              <strong>{authCandidateUser.name}</strong>
            </div>
            <div>
              <span>이메일</span>
              <strong>{authCandidateUser.email}</strong>
            </div>
          </div>

          <div className="temp-page__actions">
            <button
              type="button"
              className="ghost-button ghost-button--wide"
              onClick={() => setScreen('landing')}
            >
              랜딩 보기
            </button>
            <button
              type="button"
              className="solid-button solid-button--wide"
              onClick={handleCompanyLogout}
            >
              로그아웃
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (screen === 'candidateSignup') {
    return (
      <div className="company-signup-page candidate-signup-page">
        <aside className="company-signup-page__aside">
          <button
            type="button"
            className="company-signup-page__brand"
            onClick={() => setScreen('landing')}
            aria-label="랜딩 페이지로 이동"
          >
            <WorldLogo inverted />
          </button>

          <div className="company-signup-page__hero">
            <h1>
              <span>AI 에이전트로</span>
              <span>공정한 블라인드 평가.</span>
            </h1>
            <p>
              <span>World ID로 실제 사람만 참여합니다.</span>
              <span>지원자의 개인정보는 매칭 동의 전까지 비공개됩니다.</span>
            </p>
          </div>

          <div className="agent-card-list">
            {agentCards.map((agent) => (
              <article className="agent-card" key={agent.title}>
                <div className="agent-card__icon" aria-hidden="true" />
                <div className="agent-card__copy">
                  <strong>{agent.title}</strong>
                  <span>{agent.description}</span>
                </div>
                <div className="agent-card__status" aria-hidden="true" />
              </article>
            ))}
          </div>
        </aside>

        <section className="company-signup-page__panel">
          <div className="company-signup-page__panel-inner">
            {!candidateSubmitted ? (
              <form
                className={`candidate-form${candidateVerificationSent ? ' candidate-form--verification-sent' : ''}${candidateVerificationConfirmed ? ' candidate-form--verified' : ''}`}
                onSubmit={handleCandidateSubmit}
                noValidate
              >
                <h2>계정 만들기</h2>

                <label className="company-field">
                  <span className="company-field__label">이름</span>
                  <input
                    className={`company-field__input${candidateErrors.name ? ' company-field__input--error' : ''}`}
                    type="text"
                    name="name"
                    placeholder="홍길동"
                    value={candidateForm.name}
                    onChange={handleCandidateChange}
                  />
                  {candidateErrors.name ? (
                    <span className="company-field__error">{candidateErrors.name}</span>
                  ) : null}
                </label>

                <div className="company-form__email-row candidate-form__email-row">
                  <label className="company-field company-field--email">
                    <span className="company-field__label">이메일</span>
                    <input
                      className={`company-field__input${candidateErrors.email ? ' company-field__input--error' : ''}`}
                      type="email"
                      name="email"
                      placeholder="you@example.com"
                      value={candidateForm.email}
                      onChange={handleCandidateChange}
                      readOnly={candidateVerificationSent}
                    />
                    {candidateErrors.email ? (
                      <span className="company-field__error">{candidateErrors.email}</span>
                    ) : null}
                  </label>

                  <button
                    type="button"
                    className={`company-form__verify${candidateVerificationSent ? ' company-form__verify--timer' : ''}`}
                    onClick={handleCandidateVerificationSend}
                    disabled={isSendingCandidateVerification || candidateVerificationSecondsLeft > 0}
                  >
                    {isSendingCandidateVerification ? '전송 중...' : '인증번호 전송'}
                  </button>
                </div>

                {candidateVerificationSecondsLeft > 0 ? (
                  <p className="company-form__cooldown" role="status">
                    {candidateVerificationSecondsLeft}초 뒤에 다시 요청할 수 있습니다.
                  </p>
                ) : null}

                {candidateVerificationSent ? (
                  <div className="company-form__email-row company-form__email-row--auth candidate-form__email-row candidate-form__email-row--auth">
                    <label className="company-field company-field--email">
                      <span className="company-field__label">이메일 인증번호</span>
                      <input
                        className={`company-field__input${candidateErrors.verificationCode ? ' company-field__input--error' : ''}`}
                        type="text"
                        name="verificationCode"
                        placeholder={candidateVerificationCodePlaceholder}
                        value={candidateForm.verificationCode}
                        onChange={handleCandidateChange}
                      />
                      {candidateVerificationConfirmed ? (
                        <span className="company-field__success">* 인증되었습니다.</span>
                      ) : null}
                      {candidateErrors.verificationCode ? (
                        <span className="company-field__error">{candidateErrors.verificationCode}</span>
                      ) : null}
                    </label>

                    <button
                      type="button"
                      className="company-form__verify company-form__verify--confirm"
                      onClick={handleCandidateVerificationCheck}
                      disabled={isCheckingCandidateVerification}
                    >
                      {isCheckingCandidateVerification ? '확인 중...' : '인증하기'}
                    </button>
                  </div>
                ) : null}

                {candidateVerificationConfirmed ? (
                  <section className="candidate-form__world-id" aria-label="World ID 인증 안내">
                    <div className="candidate-form__world-id-icon" aria-hidden="true">
                      <WorldLogoMark inverted={true} />
                    </div>
                    <div className="candidate-form__world-id-copy">
                      <strong>
                        {!candidateWorldIdConfig?.enabled
                          ? 'World ID 설정 필요'
                          : candidateWorldIdVerified
                            ? 'World ID 인증 완료'
                            : 'World ID 인증 필요'}
                      </strong>
                      <span>
                        {!candidateWorldIdConfig?.enabled
                          ? 'Developer Portal에서 발급한 app_id, rp_id, signing_key가 필요합니다.'
                          : candidateWorldIdVerified
                            ? '실제 World ID proof 검증이 완료되었습니다.'
                            : 'Proof of Personhood 검증으로 중복·봇 계정을 방지합니다.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`candidate-form__world-id-button${candidateWorldIdVerified ? ' candidate-form__world-id-button--verified' : ''}`}
                      onClick={handleCandidateWorldIdStart}
                      disabled={isPreparingCandidateWorldId || isVerifyingCandidateWorldId}
                    >
                      {candidateWorldIdButtonLabel}
                    </button>
                  </section>
                ) : null}

                {candidateVerificationConfirmed && candidateWorldIdError ? (
                  <span className="company-field__error company-field__error--inline">
                    {candidateWorldIdError}
                  </span>
                ) : null}

                <div className="candidate-form__spacer" />

                <label className="company-check">
                  <input
                    type="checkbox"
                    name="termsAgreed"
                    checked={candidateForm.termsAgreed}
                    onChange={handleCandidateChange}
                  />
                  <span>이용약관 및 개인정보 수집·이용에 동의합니다.</span>
                </label>
                {candidateErrors.termsAgreed ? (
                  <span className="company-field__error company-field__error--inline">
                    {candidateErrors.termsAgreed}
                  </span>
                ) : null}

                {candidateSubmitError ? (
                  <p className="company-form__server-error" role="alert">
                    {candidateSubmitError}
                  </p>
                ) : null}

                <button type="submit" className="company-form__submit candidate-form__submit">
                  {isCandidateSubmitting ? '회원가입 처리 중...' : '회원가입 하기'}
                </button>

                <p className="company-form__login candidate-form__login">
                  이미 계정이 있으신가요?{' '}
                  <button type="button" onClick={openLoginFlow}>
                    로그인
                  </button>
                </p>
              </form>
            ) : (
              <section className="company-success" aria-live="polite">
                <span className="success-state__badge">가입 요청 완료</span>
                <h2>개인 계정 생성을 위한 확인 메일을 보냈습니다.</h2>
                <p>
                  <strong>{candidateForm.email}</strong> 로 인증 메일을 전송했습니다.
                  메일 인증 후 World ID 확인과 지원자 대시보드 연결 단계로 이어집니다.
                </p>

                <div className="success-state__summary">
                  <div>
                    <span>이름</span>
                    <strong>{candidateForm.name}</strong>
                  </div>
                  <div>
                    <span>등록 이메일</span>
                    <strong>{candidateForm.email}</strong>
                  </div>
                </div>

                <div className="company-success__actions">
                  <button
                    type="button"
                    className="ghost-button ghost-button--wide"
                    onClick={() => setCandidateSubmitted(false)}
                  >
                    정보 수정
                  </button>
                  <button
                    type="button"
                    className="solid-button solid-button--wide"
                    onClick={() => setScreen('landing')}
                  >
                    랜딩으로 이동
                  </button>
                </div>
              </section>
            )}
          </div>
        </section>

        {candidateWorldIdRequest ? (
          <IDKitRequestWidget
            open={candidateWorldIdOpen}
            onOpenChange={setCandidateWorldIdOpen}
            app_id={candidateWorldIdRequest.appId}
            action={candidateWorldIdRequest.action}
            rp_context={candidateWorldIdRequest.rpContext as RpContext}
            allow_legacy_proofs={true}
            environment={candidateWorldIdRequest.environment}
            preset={orbLegacy({ signal: candidateForm.email.trim().toLowerCase() })}
            handleVerify={handleCandidateWorldIdVerify}
            onSuccess={handleCandidateWorldIdSuccess}
            onError={handleCandidateWorldIdError}
          />
        ) : null}

        {renderLoginLayer()}
      </div>
    );
  }

  if (screen === 'companySignup') {
    return (
      <div className="company-signup-page">
        <aside className="company-signup-page__aside">
          <button
            type="button"
            className="company-signup-page__brand"
            onClick={() => setScreen('landing')}
            aria-label="랜딩 페이지로 이동"
          >
            <WorldLogo inverted />
          </button>

          <div className="company-signup-page__hero">
            <h1>
              <span>전문 분야별 AI 에이전트로</span>
              <span>더 정밀하고 효율적으로.</span>
            </h1>
            <p>
              <span>World ID로 실제 사람만 참여합니다.</span>
              <span>전문 AI 에이전트를 통해 직무별·목적별 맞춤 평가를</span>
              <span>빠르고 공정하게 운영할 수 있습니다.</span>
            </p>
          </div>

          <div className="agent-card-list">
            {agentCards.map((agent) => (
              <article className="agent-card" key={agent.title}>
                <div className="agent-card__icon" aria-hidden="true" />
                <div className="agent-card__copy">
                  <strong>{agent.title}</strong>
                  <span>{agent.description}</span>
                </div>
                <div className="agent-card__status" aria-hidden="true" />
              </article>
            ))}
          </div>
        </aside>

        <section className="company-signup-page__panel">
          <div className="company-signup-page__panel-inner">
            <form
              className={`company-form${verificationSent ? ' company-form--verification-sent' : ''}${verificationConfirmed ? ' company-form--verified' : ''}`}
              onSubmit={handleCompanySubmit}
              noValidate
            >
                <h2>계정 만들기</h2>

                <label className="company-field">
                  <span className="company-field__label">기업명</span>
                  <input
                    className={`company-field__input${companyErrors.companyName ? ' company-field__input--error' : ''}`}
                    type="text"
                    name="companyName"
                    value={companyForm.companyName}
                    onChange={handleCompanyChange}
                  />
                  {companyErrors.companyName ? (
                    <span className="company-field__error">{companyErrors.companyName}</span>
                  ) : null}
                </label>

                <div className="company-form__email-row">
                  <label className="company-field company-field--email">
                    <span className="company-field__label">기업 이메일</span>
                    <input
                      className={`company-field__input${companyErrors.companyEmail ? ' company-field__input--error' : ''}`}
                      type="email"
                      name="companyEmail"
                      placeholder="you@example.com"
                      value={companyForm.companyEmail}
                      onChange={handleCompanyChange}
                      readOnly={verificationSent}
                    />
                    {companyErrors.companyEmail ? (
                      <span className="company-field__error">{companyErrors.companyEmail}</span>
                    ) : null}
                  </label>

                  <button
                    type="button"
                    className={`company-form__verify${verificationSent ? ' company-form__verify--timer' : ''}`}
                    onClick={handleVerificationSend}
                    disabled={isSendingCompanyVerification || verificationSecondsLeft > 0}
                  >
                    {isSendingCompanyVerification ? '전송 중...' : '인증번호 전송'}
                  </button>
                </div>

                {verificationSecondsLeft > 0 ? (
                  <p className="company-form__cooldown" role="status">
                    {verificationSecondsLeft}초 뒤에 다시 요청할 수 있습니다.
                  </p>
                ) : null}

                {verificationSent ? (
                  <div className="company-form__email-row company-form__email-row--auth">
                    <label className="company-field company-field--email">
                      <span className="company-field__label">기업 이메일 인증번호</span>
                      <input
                        className={`company-field__input${companyErrors.verificationCode ? ' company-field__input--error' : ''}`}
                        type="text"
                        name="verificationCode"
                        placeholder={companyVerificationCodePlaceholder}
                        value={companyForm.verificationCode}
                        onChange={handleCompanyChange}
                      />
                      {verificationConfirmed ? (
                        <span className="company-field__success">* 인증되었습니다.</span>
                      ) : null}
                      {companyErrors.verificationCode ? (
                        <span className="company-field__error">
                          {companyErrors.verificationCode}
                        </span>
                      ) : null}
                    </label>

                    <button
                      type="button"
                      className="company-form__verify company-form__verify--confirm"
                      onClick={handleVerificationCheck}
                      disabled={isCheckingCompanyVerification}
                    >
                      {isCheckingCompanyVerification ? '확인 중...' : '인증하기'}
                    </button>
                  </div>
                ) : null}

                {verificationConfirmed ? (
                  <div className="company-form__password-row">
                    <label className="company-field">
                      <span className="company-field__label">비밀번호</span>
                      <input
                        className={`company-field__input company-field__input--verified${companyErrors.password ? ' company-field__input--error' : ''}`}
                        type="password"
                        name="password"
                        value={companyForm.password}
                        onChange={handleCompanyChange}
                      />
                      {companyErrors.password ? (
                        <span className="company-field__error">{companyErrors.password}</span>
                      ) : null}
                    </label>

                    <label className="company-field">
                      <span className="company-field__label">비밀번호 재확인</span>
                      <input
                        className={`company-field__input${companyErrors.confirmPassword ? ' company-field__input--error' : ''}`}
                        type="password"
                        name="confirmPassword"
                        value={companyForm.confirmPassword}
                        onChange={handleCompanyChange}
                      />
                      {companyErrors.confirmPassword ? (
                        <span className="company-field__error">
                          {companyErrors.confirmPassword}
                        </span>
                      ) : null}
                    </label>
                  </div>
                ) : null}

                <div className="company-form__spacer" />

                <label className="company-check">
                  <input
                    type="checkbox"
                    name="termsAgreed"
                    checked={companyForm.termsAgreed}
                    onChange={handleCompanyChange}
                  />
                  <span>이용약관 및 개인정보 수집·이용에 동의합니다.</span>
                </label>
                {companyErrors.termsAgreed ? (
                  <span className="company-field__error company-field__error--inline">
                    {companyErrors.termsAgreed}
                  </span>
                ) : null}

                {companySubmitError ? (
                  <p className="company-form__server-error" role="alert">
                    {companySubmitError}
                  </p>
                ) : null}

                <button type="submit" className="company-form__submit">
                  {isCompanySubmitting ? '회원가입 처리 중...' : '회원가입 하기'}
                </button>

                <p className="company-form__login">
                  이미 계정이 있으신가요?{' '}
                  <button type="button" onClick={openLoginFlow}>
                    로그인
                  </button>
                </p>
              </form>
          </div>
        </section>

        {renderLoginLayer()}
      </div>
    );
  }

  return (
    <div className="page-shell">
      <main className="landing-page" aria-hidden={isModalOpen}>
        <header className="topbar">
          <WorldLogo />

          <div className="topbar__actions">
            <button
              type="button"
              className="ghost-button ghost-button--small"
              onClick={openLoginFlow}
            >
              로그인
            </button>
            <button
              type="button"
              className="solid-button solid-button--small"
              onClick={openSignupFlow}
            >
              회원가입
            </button>
          </div>
        </header>

        <div className="topbar-divider" />

        <section className="hero">
          <div className="hero__copy">
            <h1>
              <span>World ID 기반으로</span>
              <span>검증된 인간을, 더 공정하게</span>
            </h1>
            <p>
              <span>World ID 신원 인증과 멀티 에이전트 AI 평가를 결합해</span>
              <span>모든 선발 과정의 공정성과 신뢰를 높입니다.</span>
            </p>

            <div className="hero__actions">
              <button
                type="button"
                className="solid-button"
                onClick={() => {
                  if (authCompanyUser) {
                    setScreen('companyTemp');
                    return;
                  }

                  if (authCandidateUser) {
                    setScreen('candidateTemp');
                    return;
                  }

                  openLoginFlow();
                }}
              >
                {authCompanyUser || authCandidateUser ? '임시페이지로 이동' : '홈 대시보드'}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={openSignupFlow}
              >
                시작하기
              </button>
            </div>
          </div>
        </section>

        <section className="features">
          <h2>왜 WorldFit인가?</h2>

          <div className="feature-grid">
            {landingFeatureCards.map((card) => (
              <article className="feature-card" key={card.title}>
                <p className="feature-card__title">
                  <span className="feature-card__icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <span>{card.title}</span>
                </p>

                <div className="feature-card__description">
                  {card.description.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>

                <button
                  type="button"
                  className="feature-card__link"
                  onClick={openSignupFlow}
                >
                  자세히 보기 →
                </button>
              </article>
            ))}
          </div>
        </section>

        <footer className="footer">
          <p>© 2026 WorldFit · Built on World ID · WLD 결제</p>
          <nav aria-label="Footer links">
            <a href="/">이용약관</a>
            <a href="/">개인정보처리방침</a>
            <a href="/">고객지원</a>
          </nav>
        </footer>
      </main>

      {renderLoginLayer()}

      {isModalOpen ? (
        <div className="modal-layer" role="presentation">
          <div className="modal-backdrop" onClick={closeModal} />

          {modalStep === 'role' ? (
            <section
              className="role-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="role-modal-title"
            >
              <div className="role-modal__header">
                <WorldLogo />
                <button
                  type="button"
                  className="role-modal__close"
                  aria-label="닫기"
                  onClick={closeModal}
                >
                  ×
                </button>
              </div>

              <h3 id="role-modal-title">역할 선택</h3>

              <div className="role-modal__selector" aria-label="역할 선택">
                <button
                  type="button"
                  className={`role-pill${selectedRole === 'candidate' ? ' role-pill--active' : ''}`}
                  onClick={() => setSelectedRole('candidate')}
                >
                  지원자 (개인)
                </button>
                <button
                  type="button"
                  className={`role-pill${selectedRole === 'organizer' ? ' role-pill--active' : ''}`}
                  onClick={() => setSelectedRole('organizer')}
                >
                  기업 / 주최자
                </button>
              </div>

              <button
                type="button"
                className="role-modal__cta"
                onClick={() => {
                  if (selectedRole === 'organizer') {
                    openCompanySignupScreen();
                    return;
                  }

                  openCandidateSignupScreen();
                }}
              >
                {modalActionLabel}
              </button>
            </section>
          ) : null}

          {modalStep === 'signup' ? (
            <section
              className="signup-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="signup-modal-title"
            >
              <div className="role-modal__header">
                <WorldLogo />
                <button
                  type="button"
                  className="role-modal__close"
                  aria-label="닫기"
                  onClick={closeModal}
                >
                  ×
                </button>
              </div>

              <div className="signup-modal__intro">
                <button
                  type="button"
                  className="signup-modal__back"
                  onClick={() => setModalStep('role')}
                >
                  ← 역할 다시 선택
                </button>
                <h3 id="signup-modal-title">{candidateSignupTitle}</h3>
                <p>{candidateSignupDescription}</p>
              </div>

              <form className="signup-form" onSubmit={handleCandidateSubmit} noValidate>
                <div className="signup-form__grid">
                  <label className="field">
                    <span className="field__label">이름</span>
                    <input
                      className={`field__input${candidateErrors.name ? ' field__input--error' : ''}`}
                      name="name"
                      type="text"
                      placeholder="홍길동"
                      value={candidateForm.name}
                      onChange={handleCandidateChange}
                    />
                    {candidateErrors.name ? (
                      <span className="field__error">{candidateErrors.name}</span>
                    ) : null}
                  </label>

                  <label className="field">
                    <span className="field__label">이메일</span>
                    <input
                      className={`field__input${candidateErrors.email ? ' field__input--error' : ''}`}
                      name="email"
                      type="email"
                      placeholder="name@worldfit.ai"
                      value={candidateForm.email}
                      onChange={handleCandidateChange}
                    />
                    {candidateErrors.email ? (
                      <span className="field__error">{candidateErrors.email}</span>
                    ) : null}
                  </label>

                  <label className="field">
                    <span className="field__label">비밀번호</span>
                    <input
                      className={`field__input${candidateErrors.password ? ' field__input--error' : ''}`}
                      name="password"
                      type="password"
                      placeholder="8자 이상 입력"
                      value={candidateForm.password}
                      onChange={handleCandidateChange}
                    />
                    {candidateErrors.password ? (
                      <span className="field__error">{candidateErrors.password}</span>
                    ) : null}
                  </label>

                  <label className="field">
                    <span className="field__label">소속 / 학교 / 커뮤니티</span>
                    <input
                      className={`field__input${candidateErrors.organization ? ' field__input--error' : ''}`}
                      name="organization"
                      type="text"
                      placeholder="예: 서울대학교 / 개인 프로젝트"
                      value={candidateForm.organization}
                      onChange={handleCandidateChange}
                    />
                    {candidateErrors.organization ? (
                      <span className="field__error">{candidateErrors.organization}</span>
                    ) : null}
                  </label>
                </div>

                <label className="field">
                  <span className="field__label">초대 코드</span>
                  <input
                    className="field__input"
                    name="inviteCode"
                    type="text"
                    placeholder="선택 입력"
                    value={candidateForm.inviteCode}
                    onChange={handleCandidateChange}
                  />
                </label>

                <div className="signup-form__meta">
                  <div className="signup-form__summary">
                    <span className="signup-form__badge">개인 계정</span>
                    <p>
                      가입 후 World ID 인증과 역할별 대시보드 연결 단계로
                      이어집니다.
                    </p>
                  </div>

                  <div className="signup-form__checks">
                    <label className="check">
                      <input
                        name="marketingConsent"
                        type="checkbox"
                        checked={candidateForm.marketingConsent}
                        onChange={handleCandidateChange}
                      />
                      <span>출시 소식과 업데이트 메일 수신에 동의합니다. (선택)</span>
                    </label>

                    <label className="check">
                      <input
                        name="termsAgreed"
                        type="checkbox"
                        checked={candidateForm.termsAgreed}
                        onChange={handleCandidateChange}
                      />
                      <span>이용약관 및 개인정보처리방침에 동의합니다. (필수)</span>
                    </label>
                    {candidateErrors.termsAgreed ? (
                      <span className="field__error">{candidateErrors.termsAgreed}</span>
                    ) : null}
                  </div>
                </div>

                <div className="signup-form__actions">
                  <button
                    type="button"
                    className="ghost-button ghost-button--wide"
                    onClick={() => setModalStep('role')}
                  >
                    이전
                  </button>
                  <button type="submit" className="solid-button solid-button--wide">
                    지원자 계정 생성
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {modalStep === 'success' ? (
            <section
              className="signup-modal signup-modal--success"
              role="dialog"
              aria-modal="true"
              aria-labelledby="signup-success-title"
            >
              <div className="role-modal__header">
                <WorldLogo />
                <button
                  type="button"
                  className="role-modal__close"
                  aria-label="닫기"
                  onClick={closeModal}
                >
                  ×
                </button>
              </div>

              <div className="success-state">
                <span className="success-state__badge">가입 완료</span>
                <h3 id="signup-success-title">
                  {candidateForm.name || '새 계정'}님의 가입 요청이 접수되었습니다.
                </h3>
                <p>
                  {candidateForm.email} 로 확인 메일을 보냈습니다. 다음 단계에서
                  World ID 인증을 완료하면 평가 세션 참여가 가능합니다.
                </p>

                <div className="success-state__summary">
                  <div>
                    <span>가입 유형</span>
                    <strong>지원자 (개인)</strong>
                  </div>
                  <div>
                    <span>소속 / 학교 / 커뮤니티</span>
                    <strong>{candidateForm.organization}</strong>
                  </div>
                </div>

                <div className="signup-form__actions">
                  <button
                    type="button"
                    className="ghost-button ghost-button--wide"
                    onClick={() => {
                      setModalStep('signup');
                    }}
                  >
                    정보 수정
                  </button>
                  <button
                    type="button"
                    className="solid-button solid-button--wide"
                    onClick={closeModal}
                  >
                    시작 화면으로
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default App;
