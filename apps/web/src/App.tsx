import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { ShopPage } from "./pages/ShopPage";
import { BookingPage } from "./pages/BookingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { Protected } from "./components/Protected";
import { SiteSettingsPage } from "./pages/SiteSettingsPage";
import { ProgramBuilderPage } from "./pages/ProgramBuilderPage";
import { ContactPage } from "./pages/ContactPage";
import { PaymentPage } from "./pages/PaymentPage";
import { MemberDirectoryPage } from "./pages/MemberDirectoryPage";
import {
  MemberLayout,
  MemberNotificationsPage,
  MemberOffersPage,
  MemberOnboardingPage,
  MemberOverviewPage,
  MemberPaymentsPage,
  MemberProgressPage,
  MemberStatsPage,
  MemberTimelinePage,
  MemberRecapsPage,
  MemberSettingsPage,
  MemberCalendarPage,
  MemberVideosPage,
  MemberPaymentStatusPage,
  MemberBookingPage
} from "./pages/member/MemberArea";
import {
  CoachBillingPage,
  CoachInboxPage,
  CoachLayout,
  CoachNotificationsPage,
  CoachOverviewPage,
  CoachProductsPage,
  CoachRecapsPage,
  CoachWorkflowsPage,
  CoachSettingsPage,
  CoachAvailabilityPage,
  CoachVideosPage
} from "./pages/coach/CoachArea";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="payment" element={<PaymentPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route
        path="/booking"
        element={
          <Protected role="MEMBER">
            <BookingPage />
          </Protected>
        }
      />
      <Route
        path="/member/*"
        element={
          <Protected role="MEMBER">
            <MemberLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<MemberOverviewPage />} />
        <Route path="onboarding" element={<MemberOnboardingPage />} />
        <Route path="booking" element={<MemberBookingPage />} />
        <Route path="stats" element={<MemberStatsPage />} />
        <Route path="offers" element={<MemberOffersPage />} />
        <Route path="payment" element={<MemberPaymentStatusPage />} />
        <Route path="timeline" element={<MemberTimelinePage />} />
        <Route path="videos" element={<MemberVideosPage />} />
        <Route path="recaps" element={<MemberRecapsPage />} />
        <Route path="payments" element={<MemberPaymentsPage />} />
        <Route path="progress" element={<MemberProgressPage />} />
        <Route path="calendar" element={<MemberCalendarPage />} />
        <Route path="notifications" element={<MemberNotificationsPage />} />
        <Route path="settings" element={<MemberSettingsPage />} />
      </Route>
      <Route
        path="/coach/*"
        element={
          <Protected role="COACH">
            <CoachLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<CoachOverviewPage />} />
        <Route path="workflows" element={<CoachWorkflowsPage />} />
        <Route path="products" element={<CoachProductsPage />} />
        <Route path="calendar" element={<CoachAvailabilityPage />} />
        <Route path="videos" element={<CoachVideosPage />} />
        <Route path="notifications" element={<CoachNotificationsPage />} />
        <Route path="recaps" element={<CoachRecapsPage />} />
        <Route path="inbox" element={<CoachInboxPage />} />
        <Route path="billing" element={<CoachBillingPage />} />
        <Route path="settings" element={<CoachSettingsPage />} />
        <Route path="members" element={<MemberDirectoryPage />} />
      </Route>
      <Route
        path="/coach/site"
        element={
          <Protected role="COACH">
            <SiteSettingsPage />
          </Protected>
        }
      />
      <Route
        path="/coach/programs"
        element={
          <Protected role="COACH">
            <ProgramBuilderPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
