hello = Hello!

greeting = Hello { $first_name }!

cart = { $first_name }, there {
  $apples ->
    [0] are no apples
    [one] is one apple
    *[other] are { $apples } apples
  } in your cart.

checkout = Thank you for purchasing!
