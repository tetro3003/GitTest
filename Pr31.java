import acm.program.ConsoleProgram;

public class Pr31 extends ConsoleProgram {
	
	public void run(){
		int num = readInt("Enter Number: ");
		simpleNumberChecker(num);
		
	}
	private void simpleNumberChecker(int number){
		
		int a = 0;
		
		for(int i = 0; i < number; i++ ){
			
			if(number%(i+1)==0){
				a++;
			}
			
		}
		
		if(a>2) println("Your Number Is NOT Simple!");
		else println("Your Number Is Simple!");
		
	}
	

}
