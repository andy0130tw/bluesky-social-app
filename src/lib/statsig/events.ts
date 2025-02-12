export type LogEvents = {
  // App events
  init: {
    initMs: number
  }
  'account:loggedIn': {
    logContext: 'LoginForm' | 'SwitchAccount' | 'ChooseAccountForm' | 'Settings'
    withPassword: boolean
  }
  'account:loggedOut': {
    logContext: 'SwitchAccount' | 'Settings' | 'Deactivated'
  }
  'notifications:openApp': {}
  'state:background': {
    secondsActive: number
  }
  'state:foreground': {}
  'router:navigate': {}

  // Screen events
  'splash:signInPressed': {}
  'splash:createAccountPressed': {}
  'signup:nextPressed': {
    activeStep: number
  }
  'onboarding:interests:nextPressed': {
    selectedInterests: string[]
    selectedInterestsLength: number
  }
  'onboarding:suggestedAccounts:nextPressed': {
    selectedAccountsLength: number
    skipped: boolean
  }
  'onboarding:followingFeed:nextPressed': {}
  'onboarding:algoFeeds:nextPressed': {
    selectedPrimaryFeeds: string[]
    selectedPrimaryFeedsLength: number
    selectedSecondaryFeeds: string[]
    selectedSecondaryFeedsLength: number
  }
  'onboarding:topicalFeeds:nextPressed': {
    selectedFeeds: string[]
    selectedFeedsLength: number
  }
  'onboarding:moderation:nextPressed': {}
  'onboarding:finished:nextPressed': {}
  'home:feedDisplayed': {
    feedUrl: string
    feedType: string
    index: number
    reason: 'focus' | 'tabbar-click' | 'pager-swipe' | 'desktop-sidebar-click'
  }
  'feed:endReached': {
    feedUrl: string
    feedType: string
    itemCount: number
  }
  'feed:refresh': {
    feedUrl: string
    feedType: string
    reason: 'pull-to-refresh' | 'soft-reset' | 'load-latest'
  }

  // Data events
  'account:create:begin': {}
  'account:create:success': {}
  'post:create': {
    imageCount: number
    isReply: boolean
    hasLink: boolean
    hasQuote: boolean
    langs: string
    logContext: 'Composer'
  }
  'post:like': {
    doesLikerFollowPoster: boolean | undefined
    doesPosterFollowLiker: boolean | undefined
    likerClout: number | undefined
    postClout: number | undefined
    logContext: 'FeedItem' | 'PostThreadItem' | 'Post'
  }
  'post:repost': {
    logContext: 'FeedItem' | 'PostThreadItem' | 'Post'
  }
  'post:unlike': {
    logContext: 'FeedItem' | 'PostThreadItem' | 'Post'
  }
  'post:unrepost': {
    logContext: 'FeedItem' | 'PostThreadItem' | 'Post'
  }
  'profile:follow': {
    didBecomeMutual: boolean | undefined
    followeeClout: number | undefined
    followerClout: number | undefined
    logContext:
      | 'RecommendedFollowsItem'
      | 'PostThreadItem'
      | 'ProfileCard'
      | 'ProfileHeader'
      | 'ProfileHeaderSuggestedFollows'
      | 'ProfileMenu'
  }
  'profile:unfollow': {
    logContext:
      | 'RecommendedFollowsItem'
      | 'PostThreadItem'
      | 'ProfileCard'
      | 'ProfileHeader'
      | 'ProfileHeaderSuggestedFollows'
      | 'ProfileMenu'
  }
}
