import acm.program.ConsoleProgram;

import java.util.Random;

public class Pr38 extends ConsoleProgram {

    public void run() {

        int budget = 1000;

        while (budget != 0){

            int bet = readInt("$Enter Your Bet: ");


                while (bet>budget){
                    println("Your bet was bigger than you budget, enter right Num");
                    bet = readInt("$Enter Your Bet: ");
                }



            int choice = readInt("Enter Your choice: ");

            if (ruletka(choice) == 1){
                budget += bet;
                println("You Won: - " + bet + "$");
                println("Budget: " + budget);
            } else {
                budget -= bet;
                println("You Lost - " + bet + "$");
                println("Budget: " + budget);
            }

            if (budget == 0){
                println("Unfortunately, You Lost!");
            }

        }



    }

    private int ruletka(int userNum){

        Random rul = new Random();
        int randNum = rul.nextInt(36);

        if (userNum == randNum){
            println("Winner Number: " + randNum);
            return 1;
        } else {
            println("Winner Number: " + randNum);
            return 0;
        }

    }
}
